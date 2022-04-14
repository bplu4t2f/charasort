"use strict";

// state object:
// N : int
// sortedIndices : int[]

// root : int (-> idx sortedIndices)
// val : int (-> idx user element array)
// parent : int (-> idx sortedIndices)
// child : int (-> idx sortedIndices)
// location : int

// knownResults : (int smaller, int bigger) -> (int choice)

// ContestantL : int (-> idx user element array)
// ContestantR : int (-> idx user element array)


function shs_create(N)
{
  let sortedIndices = Array(N);
  for (let i = 0; i < N; ++i)
  {
    sortedIndices[i] = i;
  }
  
  let state =
  {
    N: N,
    sortedIndices: sortedIndices,
    
    root: N >> 1,
    val: 0,
    parent: 0,
    child: 0,
    location: 0,
    
    knownResults: {},
    
    ContestantL: -1,
    ContestantR: -1
  };
  
  shs_setup_next(state);
  
  return state;
}


// For undo
function shs_clone_state(state)
{
  return JSON.parse(JSON.stringify(state));
}


function shs_is_completed(state)
{
  return state.N == 0;
}


// Returns ROUGH ESTIMATE of the progress from 0 to 1
function shs_get_progress(state)
{
  let total = state.sortedIndices.length;
  let total_estimated_comparisons = total * Math.log2(total);
  let estimated_during_heap_construction = total;
  
  
  // During heap construction, percentage goes from 0 to percent_heap_construction;
  // after heap construction, percentage goes from percent_heap_construction to 100%.
  let percent_heap_construction = estimated_during_heap_construction / total_estimated_comparisons;
  
  // Try to estimate the state of the heap sort
  let build_heap_stage = state.root !== 0;
  if (build_heap_stage) {
    let max = state.N >> 1;
    let build_heap_progress = 1.0 - state.root / max;
    return build_heap_progress * percent_heap_construction;
  } else {
    let after_heap_construction_progress = (total - state.N) / total;
    let percent_after_heap_construction = 1.0 - percent_heap_construction;
    return percent_heap_construction + percent_after_heap_construction * after_heap_construction_progress;
  }
}


function shs_setup_next(state)
{
  if (state.N == 0) return;

  if (state.root != 0)
  {
    state.parent = --state.root;
    state.val = state.sortedIndices[state.root];
  }
  else
  {
    if (--state.N != 0)
    {
      state.val = state.sortedIndices[state.N];
      state.sortedIndices[state.N] = state.sortedIndices[0];
      state.parent = 0;
    }
    else
    {
      // is completed
      return;
    }
  }

  if (!shs_first_while(state)) return;

  shs_second_if_and_beyond(state);
}


function shs_first_while(state)
{
  state.child = (state.parent + 1) << 1;
  if (state.child < state.N)
  {
    state.location = 1;
    state.ContestantL = state.sortedIndices[state.child - 1];
    state.ContestantR = state.sortedIndices[state.child];
    return false;
  }
  return true;
}


function shs_second_if_and_beyond(state)
{
  if (state.child == state.N)
  {
    state.location = 2;
    state.ContestantL = state.sortedIndices[--state.child];
    state.ContestantR = state.val;
  }
  else
  {
    state.location = 3;
    state.ContestantL = state.sortedIndices[state.parent];
    state.ContestantR = state.val;
  }
}


function shs_second_while_and_beyond(state)
{
  if (state.child != state.root)
  {
    state.parent = (state.child - 1) >> 1;
    state.location = 4;
    state.ContestantL = state.sortedIndices[state.parent];
    state.ContestantR = state.val;
    return;
  }

  shs_beyond_second_while(state);
}


function shs_beyond_second_while(state)
{
  state.sortedIndices[state.child] = state.val;
	shs_setup_next(state);
}


// Should be called by the application while shs_is_compelted is false.
// examine state.ContestantL and choice.ContestantR to find out which characters to compare.
// choice < 0 means ContstantL < ContestantR
function shs_pick(state, choice)
{
  if (state.N == 0) return;

  // Add this choice to the known results, so that we don't bother the user again
  {
    if (state.ContestantL < state.ContestantR)
    {
      let key = `${state.ContestantL},${state.ContestantR}`;
      state.knownResults[key] = choice;
    }
    else
    {
      let key = `${state.ContestantR},${state.ContestantL}`;
      state.knownResults[key] = -choice;
    }
  }

  do
  {
    switch (state.location)
    {
      case 1:
        if (choice > 0)
        {
          --state.child;
        }
        state.sortedIndices[state.parent] = state.sortedIndices[state.child];
        state.parent = state.child;
        if (!shs_first_while(state)) break;

        shs_second_if_and_beyond(state);

        break;

      case 2:
        if (choice >= 0)
        {
          state.sortedIndices[state.parent] = state.sortedIndices[state.child];
          state.sortedIndices[state.child] = state.val;
          shs_setup_next(state);
          break;
        }

        state.child = state.parent;

        shs_second_while_and_beyond(state);
        
        break;

      case 3:
        if (choice >= 0)
        {
          state.sortedIndices[state.parent] = state.val;
          shs_setup_next(state);
          break;
        }

        state.child = (state.parent - 1) >> 1;

        shs_second_while_and_beyond(state);

        break;

      case 4:
        if (choice >= 0)
        {
          shs_beyond_second_while(state);
          break;
        }

        state.sortedIndices[state.child] = state.sortedIndices[state.parent];
        state.child = state.parent;

        shs_second_while_and_beyond(state);

        break;

      default:
        throw new Error(`invalid state - ${state.location}`);
    }
    
    // Check to see if the next choice was already given by the user.
    // In heap sort, sometimes the same two elements may be compared multiple times.
    {
      if (state.ContestantL < state.ContestantR)
      {
        let key = `${state.ContestantL},${state.ContestantR}`;
        let existingChoice = state.knownResults[key];
        if (existingChoice === undefined) return;
        choice = existingChoice;
      }
      else
      {
        let key = `${state.ContestantR},${state.ContestantL}`;
        let existingChoice = state.knownResults[key];
        if (existingChoice === undefined) return;
        choice = -existingChoice;
      }
    }
  }
  while(state.N != 0);
}
