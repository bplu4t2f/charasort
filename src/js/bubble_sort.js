// After the main sorting stage either via merge sort or heap sort, we're appending
// a single bubble sort pass (so N-1 comparisons), from the worst element to the
// best in order to give the user a last chance to improve the sorting results.

function sbs_create(sortedIndicesGetter)
{
  let state = {
    sortedIndicesGetter: sortedIndicesGetter,
    iteration: 0
  };
  
  return state;
}


function sbs_get_candidates(state)
{
  let sortedIndices = state.sortedIndicesGetter();
  let N = sortedIndices.length;
  // Right (-2) is the expected winner.
  return [sortedIndices[N - state.iteration - 1], sortedIndices[N - state.iteration - 2]];
}


function sbs_is_completed(state)
{
  return state.iteration >= state.sortedIndicesGetter().length - 1;
}


function sbs_get_progress(state)
{
  return state.iteration / state.sortedIndicesGetter().length;
}


function sbs_clone_state(state)
{
  return {
    sortedIndicesGetter: state.sortedIndicesGetter,
    iteration: state.iteration
  };
}


function sbs_pick(state, choice)
{
  if (sbs_is_completed(state)) return;
  
  // If the user picked left (choice < 0), we have to swap. Otherwise, no action needed.
  if (choice < 0) {
    let sortedIndices = state.sortedIndicesGetter();
    let N = sortedIndices.length;
    let tmp = sortedIndices[N - state.iteration - 2];
    sortedIndices[N - state.iteration - 2] = sortedIndices[N - state.iteration - 1];
    sortedIndices[N - state.iteration - 1] = tmp;
  }
  
  state.iteration += 1;
}
