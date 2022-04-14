"use strict";

// let sortedIndexList = [];
// let recordDataList  = [];
// let parentIndexList = [];
// let tiedDataList    = [];
//
// let leftIndex       = 0;
// let leftInnerIndex  = 0;
// let rightIndex      = 0;
// let rightInnerIndex = 0;
// let sortedNo        = 0;
// let pointer         = 0;


function sms_create(N)
{
  let tiedDataList = new Array(N);
  for (let i = 0; i < N; ++i) tiedDataList[i] = -1;

  let state = {
    sortedIndexList: [],
    recordDataList: new Array(N),
    parentIndexList: [],
    tiedDataList: tiedDataList,

    totalBattles: 0,
    leftIndex: 0,
    leftInnerIndex: 0,
    rightIndex: 0,
    rightInnerIndex: 0,
    sortedNo: 0,
    pointer: 0
  };

  state.sortedIndexList[0] = Array(N);
  for (let i = 0; i < N; ++i) state.sortedIndexList[0][i] = i;

  state.parentIndexList[0] = -1;

  let midpoint = 0;   // Indicates where to split the array.
  let marker   = 1;   // Indicates where to place our newly split array.

  for (let i = 0; i < state.sortedIndexList.length; i++) {
    if (state.sortedIndexList[i].length > 1) {
      let parent = state.sortedIndexList[i];
      midpoint = Math.ceil(parent.length / 2);

      state.sortedIndexList[marker] = parent.slice(0, midpoint);        // Split the array in half, and put the left half into the marked index.
      state.totalBattles += state.sortedIndexList[marker].length;       // The result's length will add to our total number of comparisons.
      state.parentIndexList[marker] = i;                                // Record where it came from.
      marker++;                                                         // Increment the marker to put the right half into.

      state.sortedIndexList[marker] = parent.slice(midpoint, parent.length);  // Put the right half next to its left half.
      state.totalBattles += state.sortedIndexList[marker].length;       // The result's length will add to our total number of comparisons.
      state.parentIndexList[marker] = i;                                // Record where it came from.
      marker++;                                                         // Rinse and repeat, until we get arrays of length 1. This is initialization of merge sort.
    }
  }

  state.leftIndex  = state.sortedIndexList.length - 2;    // Start with the second last value and...
  state.rightIndex = state.sortedIndexList.length - 1;    // the last value in the sorted list and work our way down to index 0.

  state.leftInnerIndex  = 0;                        // Inner indexes, because we'll be comparing the left array
  state.rightInnerIndex = 0;                        // to the right array, in order to merge them into one sorted array.

  return state;
}


function sms_is_completed(state)
{
  /**
   * If, after shifting the 'left' index on the sorted list, we reach past the beginning
   * of the sorted array, that means the entire array is now sorted. The original unsorted
   * array in index 0 is now replaced with a sorted version, and we will now output this.
   */
  return state.leftIndex < 0;
}


function sms_clone_state(state)
{
  return JSON.parse(JSON.stringify(state));
}


function sms_get_progress(state)
{
  return state.sortedNo / state.totalBattles;
}


function sms_pick(state, choice)
{
  if (sms_is_completed(state)) return;
  
  /**
   * For picking 'left' or 'right':
   *
   * Input the selected character's index into recordDataList. Increment the pointer of
   * recordDataList. Then, check if there are any ties with this character, and keep
   * incrementing until we find no more ties.
   */
  switch (choice) {
    case 'left': {
      recordData(state, 'left');
      while (state.tiedDataList[state.recordDataList[state.pointer - 1]] != -1) {
        recordData(state, 'left');
      }
      break;
    }
    case 'right': {
      recordData(state, 'right');
      while (state.tiedDataList[state.recordDataList [state.pointer - 1]] != -1) {
        recordData(state, 'right');
      }
      break;
    }

  /**
   * For picking 'tie' (i.e. heretics):
   *
   * Proceed as if we picked the 'left' character. Then, we record the right character's
   * index value into the list of ties (at the left character's index) and then proceed
   * as if we picked the 'right' character.
   */
    case 'tie': {
      recordData(state, 'left');
      while (state.tiedDataList[state.recordDataList[state.pointer - 1]] != -1) {
        recordData(state, 'left');
      }
      state.tiedDataList[state.recordDataList[state.pointer - 1]] = state.sortedIndexList[state.rightIndex][state.rightInnerIndex];
      recordData(state, 'right');
      while (state.tiedDataList[state.recordDataList[state.pointer - 1]] != -1) {
        recordData(state, 'right');
      }
      break;
    }
    default: return;
  }

  /**
   * Once we reach the limit of the 'right' character list, we
   * insert all of the 'left' characters into the record, or vice versa.
   */
  const leftListLen = state.sortedIndexList[state.leftIndex].length;
  const rightListLen = state.sortedIndexList[state.rightIndex].length;

  if (state.leftInnerIndex < leftListLen && state.rightInnerIndex === rightListLen) {
    while (state.leftInnerIndex < leftListLen) {
      recordData(state, 'left');
    }
  } else if (state.leftInnerIndex === leftListLen && state.rightInnerIndex < rightListLen) {
    while (state.rightInnerIndex < rightListLen) {
      recordData(state, 'right');
    }
  }

  /**
   * Once we reach the end of both 'left' and 'right' character lists, we can remove
   * the arrays from the initial mergesort array, since they are now recorded. This
   * record is a sorted version of both lists, so we can replace their original
   * (unsorted) parent with a sorted version. Purge the record afterwards.
   */
  if (state.leftInnerIndex === leftListLen && state.rightInnerIndex === rightListLen) {
    for (let i = 0; i < leftListLen + rightListLen; i++) {
      state.sortedIndexList[state.parentIndexList[state.leftIndex]][i] = state.recordDataList[i];
    }
    state.sortedIndexList.pop();
    state.sortedIndexList.pop();
    state.leftIndex = state.leftIndex - 2;
    state.rightIndex = state.rightIndex - 2;
    state.leftInnerIndex = 0;
    state.rightInnerIndex = 0;

    state.sortedIndexList.forEach((val, idx) => state.recordDataList[idx] = 0);
    state.pointer = 0;
  }
}


/**
 * Records data in recordDataList.
 *
 * @param {'left'|'right'} choice Record from the left or the right character array.
 */
function recordData(state, choice) {
  if (choice === 'left') {
    state.recordDataList[state.pointer] = state.sortedIndexList[state.leftIndex][state.leftInnerIndex];
    state.leftInnerIndex++;
  } else {
    state.recordDataList[state.pointer] = state.sortedIndexList[state.rightIndex][state.rightInnerIndex];
    state.rightInnerIndex++;
  }

  state.pointer++;
  state.sortedNo++;
}
