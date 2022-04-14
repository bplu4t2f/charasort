"use strict";

/** @type {CharData} */
let characterData       = [];   // Initial character data set used.
/** @type {CharData} */
let characterDataToSort = [];   // Character data set after filtering.
/** @type {Options} */
let options             = [];   // Initial option set used.

let currentVersion      = '';   // Which version of characterData and options are used.

let resultImageAmountSelectElement = null;

/** @type {(boolean|boolean[])[]} */
let optTaken  = [];             // Records which options are set.

/** Save Data. Concatenated into array, joined into string (delimited by '|') and compressed with lz-string. */
let timestamp = 0;        // savedata[0]      (Unix time when sorter was started, used as initial PRNG seed and in dataset selection)
let timeTaken = 0;        // savedata[1]      (Number of ms elapsed when sorter ends, used as end-of-sort flag and in filename generation)
let choices   = '';       // savedata[2]      (String of '0', '1' and '2' that records what sorter choices are made)
let staticOptStr = "";    // savedata[3]
let optStr    = '';       // savedata[4]      (String of '0' and '1' that denotes top-level option selection)
let suboptStr = '';       // savedata[5...n]  (String of '0' and '1' that denotes nested option selection, separated by '|')
let timeError = false;    // Shifts entire savedata array to the right by 1 and adds an empty element at savedata[0] if true.

/** Intermediate sorter data. */
let g_shs_state = null;
let g_sms_state = null;
let g_sbs_state = null;
//let scoreByCharacter = [];
//let tempSortedCharacterIndices = [];
//let sortedIndexList = [];
//let recordDataList  = [];
//let parentIndexList = [];
//let tiedDataList    = [];

//let currentComparisonIndexL = 0;
//let currentComparisonIndexR = 0;
//let leftIndex       = 0;
//let leftInnerIndex  = 0;
//let rightIndex      = 0;
//let rightInnerIndex = 0;
let battleNo        = 1;
//let sortedNo        = 0;
//let pointer         = 0;
//let currentScoreThreshold = 0;
let eliminatedIndices = [];

/** A copy of intermediate sorter data is recorded for undo() purposes. */
let g_shs_state_prev = null;
let g_sms_state_prev = null;
let g_sbs_state_prev = null;
//let scoreByCharacterPrev = [];
//let tempSortedCharacterIndicesPrev = [];
//let sortedIndexListPrev = [];
//let recordDataListPrev  = [];
//let parentIndexListPrev = [];
//let tiedDataListPrev    = [];

//let currentComparisonIndexLPrev = 0;
//let currentComparisonIndexRPrev = 0;
//let leftIndexPrev       = 0;
//let leftInnerIndexPrev  = 0;
//let rightIndexPrev      = 0;
//let rightInnerIndexPrev = 0;
let battleNoPrev        = 1;
//let sortedNoPrev        = 0;
//let pointerPrev         = 0;
//let currentScoreThresholdPrev = 0;
let eliminatedIndicesPrev = [];

/** Miscellaneous sorter data that doesn't need to be saved for undo(). */
let finalCharacters = [];
let loading         = false;
let totalBattles    = 0;
let sorterURL       = window.location.host + window.location.pathname;
let storedSaveType  = localStorage.getItem(`${sorterURL}_saveType`);
let disablePreload  = true;
let use_shs         = false;
let use_bubble_stage = true;

/** Initialize script. */
function init() {

  /** Define button behavior. */
  document.getElementById("button-start").addEventListener('click', start);
  document.getElementById("button-load").addEventListener('click', loadProgress);

  document.getElementById("image-left").addEventListener('click', () => pick('left', true));
  document.getElementById("image-right").addEventListener('click', () => pick('right', true));
  
  document.getElementById("eliminate-left").addEventListener("click", () => eliminate("left"));
  document.getElementById("eliminate-right").addEventListener("click", () => eliminate("right"));
  
  //document.getElementById("button-tie").addEventListener('click', () => pick('tie'));
  document.getElementById("button-undo").addEventListener('click', undo);
  document.getElementById("button-save").addEventListener('click', () => saveProgress('Progress'));
  
  document.getElementById("button-save-finished").addEventListener('click', () => saveProgress('Last Result'));
  document.getElementById("button-getimg").addEventListener('click', generateImage);
  document.getElementById("button-list").addEventListener('click', generateTextList);

  document.getElementById("clearsave").addEventListener('click', clearProgress);
  document.getElementById("restart-seed").addEventListener("click", restartSeed);

  /** Define keyboard controls (up/down/left/right vimlike k/j/h/l). */
  document.addEventListener('keypress', (ev) => {
    if (loading) return;
    
    /** If sorting is in progress. */
    if (timestamp && !timeTaken) {
      switch(ev.key) {
        case 's': case '3':                   saveProgress('Progress'); break;
        case 'h': case 'ArrowLeft':           pick('left', true); break;
        case 'l': case 'ArrowRight':          pick('right', true); break;
        //case 'k': case '1': case 'ArrowUp':   pick('tie', true); break;
        case 'j': case '2': case 'ArrowDown': undo(); break;
        default: break;
      }
    }
    /** If sorting has ended. */
    else if (timeTaken) {
      switch(ev.key) {
        case 'k': case '1': saveProgress('Last Result'); break;
        case 'j': case '2': generateImage(); break;
        case 's': case '3': generateTextList(); break;
        default: break;
      }
    } else { // If sorting hasn't started yet.
      switch(ev.key) {
        case '1': case 's': case 'Enter': start(); break;
        case '2': case 'l':               loadProgress(); break;
        default: break;
      }
    }
  });
  
  resultImageAmountSelectElement = document.createElement("select");
  document.getElementById("result-image-amount-selector").insertAdjacentElement('beforeend', resultImageAmountSelectElement);

  /** Initialize image quantity selector for results. */
  for (let i of [0, 1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 50, 70, 100, 150, 999]) {
    const select = document.createElement('option');
    select.value = i;
    select.text = i;
    if (i === 40) { select.selected = 'selected'; }
    resultImageAmountSelectElement.insertAdjacentElement('beforeend', select);
  }

  resultImageAmountSelectElement.addEventListener('input', (e) => {
    const imageNum = e.target.options[e.target.selectedIndex].value;
    result(Number(imageNum));
  });

  /** Show load button if save data exists. */
  if (storedSaveType) {
    document.getElementById("stored-save-type").insertAdjacentText('beforeend', storedSaveType);
    document.getElementById("button-load").classList.remove("invisible");
  }

  setLatestDataset();

  /** Decode query string if available. */
  if (window.location.search.slice(1) !== '') decodeQuery();
}

/** Begin sorting. */
async function start() {
  /** Copy data into sorting array to filter. */
  characterDataToSort = characterData.slice(0);

  /** Check selected options and convert to boolean array form. */
  optTaken = [];

  options.forEach(opt => {
    if ('sub' in opt) {
      //if (!document.getElementById(`cbgroup-${opt.key}`).checked) optTaken.push(false);
      //else {
        const suboptArray = opt.sub.reduce((arr, val, idx) => {
          arr.push(document.getElementById(`cb-${opt.key}-${idx}`).checked);
          return arr;
        }, []);
        optTaken.push(suboptArray);
      //}
    } else { optTaken.push(document.getElementById(`cb-${opt.key}`).checked); }
  });

  /** Convert boolean array form to string form. */
  optStr    = '';
  suboptStr = '';

  optStr = optTaken
    .map(val => !!val)
    .reduce((str, val) => {
      str += val ? '1' : '0';
      return str;
    }, optStr);
  optTaken.forEach(val => {
    if (Array.isArray(val)) {
      suboptStr += '|';
      suboptStr += val.reduce((str, val) => {
        str += val ? '1' : '0';
        return str;
      }, '');
    }
  });

  /** Filter out deselected nested criteria and remove selected criteria. */
  options.forEach((opt, index) => {
    if ('sub' in opt) {
      if (optTaken[index]) {
        const subArray = optTaken[index].reduce((subList, subBool, subIndex) => {
          if (subBool) { subList.push(options[index].sub[subIndex].key); }
          return subList;
        }, []);
        characterDataToSort = characterDataToSort.filter(char => {
          if (!(opt.key in char.opts)) console.warn(`Warning: ${opt.key} not set for ${char.name}.`);
          return opt.key in char.opts && char.opts[opt.key].some(key => subArray.includes(key));
        });
      }
    } else if (optTaken[index]) {
      characterDataToSort = characterDataToSort.filter(char => !char.opts[opt.key]);
    }
  });

  if (characterDataToSort.length < 2) {
    alert('Cannot sort with less than two characters. Please reselect.');
    return;
  }
  
  staticOptStr = "";
  let useRandom40 = document.getElementById("pick-random-images").checked;
  staticOptStr += useRandom40 ? "1" : "0";
  use_shs = document.getElementById("use-heap-sort").checked;
  staticOptStr += use_shs ? "1" : "0";
  
  
  /** Shuffle character array with timestamp seed. */
  timestamp = timestamp || new Date().getTime();
  if (new Date(timestamp) < new Date(currentVersion)) { timeError = true; }
  Math.seedrandom(timestamp);
  
  characterDataToSort = characterDataToSort
    .map(a => [Math.random(), a])
    .sort((a,b) => a[0] - b[0])
    .map(a => a[1]);
    
  // Random 40 option -- narrow down the selection to random 40
  if (useRandom40) {
    characterDataToSort = characterDataToSort.slice(0, 40);
  }
  
  
  if (use_shs) {
	let N = characterDataToSort.length;
    totalBattles = Math.ceil(N * Math.log(N) / Math.log(2));
    g_shs_state = shs_create(characterDataToSort.length);
  } else {
	  g_sms_state = sms_create(characterDataToSort.length);
	  totalBattles = g_sms_state.totalBattles;
  }
  
  battleNo = 1;
  
  if (use_bubble_stage) {
    totalBattles += characterDataToSort.length - 1;
    // The bubble sort directly operates on the sorted indices array.
    let sortedIndicesGetter;
    if (use_shs) {
      sortedIndicesGetter = () => g_shs_state.sortedIndices;
    } else {
      sortedIndicesGetter = () => g_sms_state.sortedIndexList[0];
    }
    g_sbs_state = sbs_create(sortedIndicesGetter);
  }
  

  /** Disable all checkboxes and hide/show appropriate parts while we preload the images. */
  document.querySelectorAll('input[type=checkbox]').forEach(cb => cb.disabled = true);
  document.querySelectorAll('.starting.button').forEach(el => el.classList.add("invisible"));
  document.getElementById("button-placeholder-loading").classList.remove("invisible");
  document.getElementById("progress").style.visibility = 'visible';
  loading = true;

  try
  {
    await preloadImages();
  }
  catch (ex)
  {
    alert("Could not preload the images.\r\n" + ex);
  }
  
  loading = false;
  document.getElementById("button-placeholder-loading").classList.add("invisible");
  document.querySelectorAll('.sorting.button').forEach(el => el.classList.remove("invisible"));
  document.querySelectorAll('.image-caption').forEach(el => el.classList.remove("invisible"));
  display();
}

/** Displays the current state of the sorter. */
function display()
{
  let currently_in_bubble_stage = false;
  if (use_bubble_stage) {
    if (use_shs) {
      currently_in_bubble_stage = shs_is_completed(g_shs_state);
    } else {
      currently_in_bubble_stage = sms_is_completed(g_sms_state);
    }
  }
  
  let percent_main_stage;
  let percent_correction_stage;
  if (currently_in_bubble_stage) {
    percent_main_stage = 100;
    percent_correction_stage = Math.floor(sbs_get_progress(g_sbs_state) * 100.0);
  } else if (use_shs) {
	  percent_main_stage = Math.floor(shs_get_progress(g_shs_state) * 100.0);
    percent_correction_stage = null;
  } else {
	  percent_main_stage = Math.floor(sms_get_progress(g_sms_state) * 100.0);
    percent_correction_stage = null;
  }
  
  let leftCharIndex;
  let rightCharIndex;
  if (currently_in_bubble_stage) {
    let tmp = sbs_get_candidates(g_sbs_state);
    leftCharIndex = tmp[0];
    rightCharIndex = tmp[1];
  } else if (use_shs) {
    leftCharIndex   = g_shs_state.ContestantL;
    rightCharIndex  = g_shs_state.ContestantR;
  } else {
	  leftCharIndex   = g_sms_state.sortedIndexList[g_sms_state.leftIndex][g_sms_state.leftInnerIndex];
    rightCharIndex  = g_sms_state.sortedIndexList[g_sms_state.rightIndex][g_sms_state.rightInnerIndex];
  }
  const leftChar        = characterDataToSort[leftCharIndex];
  const rightChar       = characterDataToSort[rightCharIndex];
  
  //const charNameDisp = name => {
  //  const charName = name;//reduceTextWidth(name, 'Arial 12.8px', 220);
  //  const charTooltip = name !== charName ? name : '';
  //  return `<p title="${charTooltip}">${charName}</p>`;
  //};
  
  
  progressBar(`Battle No. ${battleNo}`, percent_main_stage, percent_correction_stage);

  if (document.getElementById("image-left").src != leftChar.img)
  {
    document.getElementById("image-left").src = "";
    document.getElementById("image-left").src = leftChar.img;
  }
  if (document.getElementById("image-right").src != rightChar.img)
  {
    document.getElementById("image-right").src = "";
    document.getElementById("image-right").src = rightChar.img;
  }

  document.getElementById("image-text-left").textContent = leftChar.name;
  document.getElementById("image-text-right").textContent = rightChar.name;
  document.getElementById("image-link-left").href = leftChar.img;
  document.getElementById("image-link-right").href = rightChar.img;
  
  if (use_shs) {
    let num_eliminated = characterDataToSort.length - g_shs_state.N;
    document.getElementById("character-stats").textContent = `Sorting ${characterDataToSort.length} contestants, ${num_eliminated} have already been eliminated`;
  } else {
	  document.getElementById("character-stats").textContent = `Sorting ${characterDataToSort.length} contestants`;  
  }

  /** Autopick if choice has been given. */
  if (choices.length !== battleNo - 1) {
    switch (Number(choices[battleNo - 1])) {
      case 0: pick('left'); break;
      case 1: pick('right'); break;
      case 2: pick('tie'); break;
      default: break;
    }
    return;
  }
  
  // Autopick if one of the current contestants was eliminated
  if (eliminatedIndices[leftCharIndex])
  {
    // This is also chosen if both character were eliminated, we don't care about that...
    pick("right");
    return;
  }
  if (eliminatedIndices[rightCharIndex])
  {
    pick("left");
    return;
  }
  
  // If we get here, no autopick happened, so use autosave.
  saveProgress('Autosave');
}


/**
 * Sort between two character choices or tie.
 * 
 * @param {'left'|'right'|'tie'} sortType
 */
// Interactive should be true if this call originated from the button click, only if it's true we're saving undo state.
// This is to prevent undo state getting overridden due to automatic picks (e.g. eliminated)
function pick(sortType, interactive) {
  if (loading) return;
  else if (!timestamp) { return start(); }
  // NOTE: Don't check timeTaken because this is called when loading a finished result
  
  // For undo
  if (interactive)
  {
    if (use_shs) {
      g_shs_state_prev = shs_clone_state(g_shs_state);
    } else {
      g_sms_state_prev = sms_clone_state(g_sms_state);
    }
    battleNoPrev = battleNo;
  }
  
  let currently_in_bubble_stage = false;
  if (use_bubble_stage) {
    if (interactive) {
      g_sbs_state_prev = sbs_clone_state(g_sbs_state);
    }
    if (use_shs) {
      currently_in_bubble_stage = shs_is_completed(g_shs_state);
    } else {
      currently_in_bubble_stage = sms_is_completed(g_sms_state);
    }
  }

  /** 
   * For picking 'left' or 'right':
   * 
   * Input the selected character's index into recordDataList. Increment the pointer of
   * recordDataList. Then, check if there are any ties with this character, and keep
   * incrementing until we find no more ties. 
   */
  switch (sortType) {
    case 'left': {
      if (choices.length === battleNo - 1) { choices += '0'; }
      if (currently_in_bubble_stage) {
        sbs_pick(g_sbs_state, -1);
      } else if (use_shs) {
        shs_pick(g_shs_state, -1);
      } else {
        sms_pick(g_sms_state, "left");
      }
      break;
    }
    case 'right': {
      if (choices.length === battleNo - 1) { choices += '1'; }
      if (currently_in_bubble_stage) { 
        sbs_pick(g_sbs_state, 1);
      } else if (use_shs) {
        shs_pick(g_shs_state, 1);
	    } else {
		    sms_pick(g_sms_state, "right");
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
      if (currently_in_bubble_stage) {
        sbs_pick(g_sbs_state, 0);
      } else if (!use_shs) {
        if (choices.length === battleNo - 1) { choices += '2'; }
		    sms_pick(g_sms_state, "tie");
	    } else {
        return; // not supported in heap sort
      }
      //recordData('left');
      //while (tiedDataList[recordDataList[pointer - 1]] != -1) {
      //  recordData('left');
      //}
      //tiedDataList[recordDataList[pointer - 1]] = sortedIndexList[rightIndex][rightInnerIndex];
      //recordData('right');
      //while (tiedDataList[recordDataList [pointer - 1]] != -1) {
      //  recordData('right');
      //}
      break;
    }
    default: return;
  }
  
  
  let is_completed;
  if (use_bubble_stage) {
    is_completed = sbs_is_completed(g_sbs_state);
  } else if (use_shs) {
	  is_completed = shs_is_completed(g_shs_state);
  } else {
	  is_completed = sms_is_completed(g_sms_state);
  }
  
  
  if (is_completed)
  {
    // Sorting done.
    timeTaken = timeTaken || new Date().getTime() - timestamp;
    progressBar(`Battle No. ${battleNo} - Completed!`, 100, use_bubble_stage ? 100 : null);
    result();
    return;
  }

  battleNo += 1;
  display();
}


// choice: "left" | "right"
function eliminate(choice)
{
  // For undo
  if (use_shs) {
    g_shs_state_prev = shs_clone_state(g_shs_state);
  } else {
    g_sms_state_prev = sms_clone_state(g_sms_state);
  }
  battleNoPrev = battleNo;
  
  let currently_in_bubble_stage = false;
  if (use_bubble_stage) {
    g_sbs_state_prev = sbs_clone_state(g_sbs_state);
    if (use_shs) {
      currently_in_bubble_stage = shs_is_completed(g_shs_state);
    } else {
      currently_in_bubble_stage = sms_is_completed(g_sms_state);
    }
  }
  
  eliminatedIndicesPrev = eliminatedIndices.slice(0);
  
  // Find out which character was eliminated
  
  let leftCharIndex;
  let rightCharIndex;
  if (currently_in_bubble_stage) {
    let tmp = sbs_get_candidates(g_sbs_state);
    leftCharIndex = tmp[0];
    rightCharIndex = tmp[1];
  } else if (use_shs) {
    leftCharIndex   = g_shs_state.ContestantL;
    rightCharIndex  = g_shs_state.ContestantR;
  } else {
	  leftCharIndex   = g_sms_state.sortedIndexList[g_sms_state.leftIndex][g_sms_state.leftInnerIndex];
    rightCharIndex  = g_sms_state.sortedIndexList[g_sms_state.rightIndex][g_sms_state.rightInnerIndex];
  }
  
  let eliminatedCharIndex;
  switch (choice)
  {
    case "left":
      eliminatedCharIndex = leftCharIndex;
      break;
    case "right":
      eliminatedCharIndex = rightCharIndex;
      break;
    default:
      return;
  }
  
  eliminatedIndices[eliminatedCharIndex] = true;
  
  display();
}


/**
 * Modifies the progress bar.
 * 
 * @param {string} indicator
 * @param {number} percentage
 */
function progressBar(indicator, percentage_main_stage, percentage_correction_stage) {
  document.getElementById("progressbattle").innerHTML = indicator;
  document.getElementById("progressfill-main-stage").style.width = `${percentage_main_stage}%`;
  document.getElementById("progresstext-main-stage").textContent = `${percentage_main_stage}%`;
  if (percentage_correction_stage !== null && percentage_correction_stage !== undefined) {
    document.getElementById("progressbar-correction-stage").classList.remove("invisible");
    document.getElementById("progressfill-correction-stage").style.width = `${percentage_correction_stage}%`;
    document.getElementById("progresstext-correction-stage").textContent = `${percentage_correction_stage}%`;
  } else {
    document.getElementById("progressbar-correction-stage").classList.add("invisible");
  }
}

/**
 * Shows the result of the sorter.
 * 
 * @param {number} [imageNum=3] Number of images to display. Defaults to 3.
 */
function result(imageNum = 40) {
  console.assert(timestamp, "timestamp not initialized (result call without start)");
  console.assert(timeTaken, "timeTaken not set before result call");
  
  document.querySelectorAll('.finished.button').forEach(el => el.classList.remove("invisible"));
  document.getElementById("result-image-amount-selector").style.display = 'block';
  document.getElementById("time-taken").style.display = 'block';
  
  document.querySelectorAll('.sorting.button').forEach(el => el.classList.add("invisible"));
  document.querySelectorAll('.image-caption').forEach(el => el.classList.add("invisible"));
  document.getElementById("options").style.display = 'none';
  document.getElementById("info").style.display = 'none';
  document.getElementById("options-static").style.display = "none";

  const header = '<div class="result head"><div class="left">Order</div><div class="right">Name</div></div>';
  const timeStr = `This sorter was completed on ${new Date(timestamp + timeTaken).toString()} and took ${msToReadableTime(timeTaken)}. <a href="${location.protocol}//${sorterURL}">Do another sorter?</a>`;
  const imgRes = (char, num) => {
    const charName = reduceTextWidth(char.name, 'Arial 12px', 160);
    const charTooltip = char.name !== charName ? char.name : '';
    return `<div class="result"><div class="left">${num}</div><div class="right"><a target="_blank" ref="noopener noreferrer" href="${char.img}"><img src="${char.img}"></a><div><span title="${charTooltip}">${charName}</span></div></div></div>`;
  }
  const res = (char, num) => {
    const charName = reduceTextWidth(char.name, 'Arial 12px', 160);
    const charTooltip = char.name !== charName ? char.name : '';
    return `<div class="result"><div class="left">${num}</div><div class="right"><a target="_blank" ref="noopener noreferrer" href="${char.img}"><span title="${charTooltip}">${charName}</span></a></div></div>`;
  }

  let rankNum       = 1;
  //let tiedRankNum   = 1;
  let imageDisplay  = imageNum;

  let finalSortedIndices;
  if (use_shs) {
	  finalSortedIndices = g_shs_state.sortedIndices.slice(0);
  } else {
	  finalSortedIndices = g_sms_state.sortedIndexList[0].slice(0);
  }
  
  const resultTable = document.getElementById("results");
  const timeElem = document.getElementById("time-taken");

  resultTable.innerHTML = header;
  timeElem.innerHTML = timeStr;
  
  for (let characterIndex of finalSortedIndices)
  {
    const character = characterDataToSort[characterIndex];
    if (imageDisplay-- > 0) {
      resultTable.insertAdjacentHTML('beforeend', imgRes(character, rankNum));
    } else {
      resultTable.insertAdjacentHTML('beforeend', res(character, rankNum));
    }
    finalCharacters.push({ rank: rankNum, name: character.name });

    rankNum += 1;

    //if (idx < characterDataToSort.length - 1) {
    //  if (tiedDataList[characterIndex] === finalSortedIndexes[idx + 1]) {
    //    tiedRankNum++;            // Indicates how many people are tied at the same rank.
    //  } else {
    //    rankNum += tiedRankNum;   // Add it to the actual ranking, then reset it.
    //    tiedRankNum = 1;          // The default value is 1, so it increments as normal if no ties.
    //  }
    //}
  }
  
  // shrink the main sorter div so that it's more obvious that the results are being displayed.
  document.querySelectorAll(".sorter").forEach(el => el.style.gridTemplateRows = "auto auto");
  document.querySelectorAll(".sorter .image").forEach(el => el.style.maxHeight = "40vh");
}

/** Undo previous choice. */
function undo() {
  if (timeTaken) { return; }

  choices = battleNo === battleNoPrev ? choices : choices.slice(0, -1);

  if (use_shs) {
	  g_shs_state = shs_clone_state(g_shs_state_prev);
  } else {
	  g_sms_state = sms_clone_state(g_sms_state_prev);
  }
  battleNo = battleNoPrev;
  if (use_bubble_stage) {
    g_sbs_state = sbs_clone_state(g_sbs_state_prev);
  }
  eliminatedIndices = eliminatedIndicesPrev.slice(0);
  
  display();
}

/** 
 * Save progress to local browser storage.
 * 
 * @param {'Autosave'|'Progress'|'Last Result'} saveType
*/
function saveProgress(saveType) {
  const saveData = generateSavedata();

  localStorage.setItem(`${sorterURL}_saveData`, saveData);
  localStorage.setItem(`${sorterURL}_saveType`, saveType);

  if (saveType !== 'Autosave') {
    const saveURL = `${location.protocol}//${sorterURL}?${saveData}`;
    const inProgressText = 'You may click Load Progress after this to resume, or use this URL.';
    const finishedText = 'You may use this URL to share this result, or click Load Last Result to view it again.';

    window.prompt(saveType === 'Last Result' ? finishedText : inProgressText, saveURL);
  }
}

/**
 * Load progress from local browser storage.
*/
function loadProgress() {
  const saveData = localStorage.getItem(`${sorterURL}_saveData`);

  if (saveData) decodeQuery(saveData);
}

/** 
 * Clear progress from local browser storage.
*/
function clearProgress() {
  storedSaveType = '';

  localStorage.removeItem(`${sorterURL}_saveData`);
  localStorage.removeItem(`${sorterURL}_saveType`);

  //document.querySelectorAll('.starting.start.button').forEach(el => el.style['grid-row'] = 'span 6');
  document.getElementById("button-load").forEach(el => el.classList.add("invisible"));
}


// Restart the sorter with the current seed (timestamp).
// Allows the user to share random 40 picks, and compare sorting results.
function restartSeed()
{
  // We do this by just visiting the "Save Progress" link, except we omit the "choices" inside the savedata string.
  if (!timestamp) return;
  let savedata = generateSavedata(false);
  let saveURL = `${location.protocol}//${sorterURL}?${savedata}`;
  window.prompt("This URL can be used to restart the sorter with the same exact options and random seed.", saveURL);
}


function generateImage() {
  const timeFinished = timestamp + timeTaken;
  const tzoffset = (new Date()).getTimezoneOffset() * 60000;
  const filename = 'sort-' + (new Date(timeFinished - tzoffset)).toISOString().slice(0, -5).replace('T', '(') + ').png';

  html2canvas(document.getElementById("results")).then(canvas => {
    const dataURL = canvas.toDataURL();
    const imgButton = document.getElementById("button-getimg");
    const resetButton = document.createElement('a');

    imgButton.removeEventListener('click', generateImage);
    imgButton.innerHTML = '';
    imgButton.insertAdjacentHTML('beforeend', `<a href="${dataURL}" download="${filename}">Download Image</a><br><br>`);

    resetButton.insertAdjacentText('beforeend', 'Reset');
    resetButton.addEventListener('click', (event) => {
      imgButton.addEventListener('click', generateImage);
      imgButton.innerHTML = 'Generate Image';
      event.stopPropagation();
    });
    imgButton.insertAdjacentElement('beforeend', resetButton);
  });
}

function generateTextList() {
  const data = finalCharacters.reduce((str, char) => {
    str += `${char.rank}. ${char.name}<br>`;
    return str;
  }, '');
  const oWindow = window.open("", "", "height=640,width=480");
  oWindow.document.write(data);
}

function generateSavedata(continueCurrent = true) {
  let effectiveChoices = continueCurrent ? choices : "";
  let effectiveTimeTaken = continueCurrent ? timeTaken : "";
  const saveData = `${timeError?'|':''}${timestamp}|${effectiveTimeTaken}|${effectiveChoices}|${staticOptStr}|${optStr}${suboptStr}`;
  return LZString.compressToEncodedURIComponent(saveData);
}

/** Retrieve latest character data and options from dataset. */
function setLatestDataset() {
  /** Set some defaults. */
  timestamp = 0;
  timeTaken = 0;
  choices   = '';

  const latestDateIndex = Object.keys(dataSet)
    .map(date => new Date(date))
    .reduce((latestDateIndex, currentDate, currentIndex, array) => {
      return currentDate > array[latestDateIndex] ? currentIndex : latestDateIndex;
    }, 0);
  currentVersion = Object.keys(dataSet)[latestDateIndex];

  characterData = dataSet[currentVersion].characterData;
  options = dataSet[currentVersion].options;

  populateOptions();
}

/** Populate option list. */
function populateOptions() {
  const optList = document.getElementById("options");
  const optInsert = (name, id, tooltip, checked = true, disabled = false) => {
    return `<div><label title="${tooltip?tooltip:name}"><input id="cb-${id}" type="checkbox" ${checked?'checked':''} ${disabled?'disabled':''}> ${name}</label></div>`;
  };
  const optInsertLarge = (name, id, tooltip, checked = true) => {
    return `<div class="large-option"><label title="${tooltip?tooltip:name}"><input id="cbgroup-${id}" type="checkbox" ${checked?'checked':''}> ${name}</label></div>`;
  };

  /** Clear out any previous options. */
  optList.innerHTML = '';

  /** Insert sorter options and set grouped option behavior. */
  for (let opt of options) {
    if ('sub' in opt) {
      //optList.insertAdjacentHTML('beforeend', optInsertLarge(opt.name, opt.key, opt.tooltip, opt.checked));
      // Heading for the option group, e.g. "series"
      optList.insertAdjacentHTML("beforeend", `<div class="large-option"><span title="${opt.tooltip?opt.tooltip:name}">${opt.name}</span></div>`);
      opt.sub.forEach((subopt, subindex) => {
        optList.insertAdjacentHTML('beforeend', optInsert(subopt.name, `${opt.key}-${subindex}`, subopt.tooltip, subopt.checked, opt.checked === false));
      });
      optList.insertAdjacentHTML('beforeend', '<hr>');

      //const groupbox = document.getElementById(`cbgroup-${opt.key}`);

      //groupbox.parentElement.addEventListener('click', () => {
      //  opt.sub.forEach((subopt, subindex) => {
      //    document.getElementById(`cb-${opt.key}-${subindex}`).disabled = !groupbox.checked;
      //    if (groupbox.checked) { document.getElementById(`cb-${opt.key}-${subindex}`).checked = true; }
      //  });
      //});
    } else {
      optList.insertAdjacentHTML('beforeend', optInsert(opt.name, opt.key, opt.tooltip, opt.checked));
    }
  }
}

/**
 * Decodes compressed shareable link query string.
 * @param {string} queryString
 */
function decodeQuery(queryString = window.location.search.slice(1)) {
  let successfulLoad;

  try {
    /** 
     * Retrieve data from compressed string. 
     * @type {string[]}
     */
    const decoded = LZString.decompressFromEncodedURIComponent(queryString).split('|');
    if (!decoded[0]) {
      decoded.splice(0, 1);
      timeError = true;
    }

    timestamp = Number(decoded.splice(0, 1)[0]);
    timeTaken = Number(decoded.splice(0, 1)[0]);
    choices   = decoded.splice(0, 1)[0];

    let staticOptDecoded = decoded.splice(0, 1)[0];
    const optDecoded    = decoded.splice(0, 1)[0];
    const suboptDecoded = decoded.slice(0);

    /** 
     * Get latest data set version from before the timestamp.
     * If timestamp is before or after any of the datasets, get the closest one.
     * If timestamp is between any of the datasets, get the one in the past, but if timeError is set, get the one in the future.
     */
    const seedDate = { str: timestamp, val: new Date(timestamp) };
    const dateMap = Object.keys(dataSet)
      .map(date => {
        return { str: date, val: new Date(date) };
      })
    const beforeDateIndex = dateMap
      .reduce((prevIndex, currDate, currIndex) => {
        return currDate.val < seedDate.val ? currIndex : prevIndex;
      }, -1);
    const afterDateIndex = dateMap.findIndex(date => date.val > seedDate.val);
    
    if (beforeDateIndex === -1) {
      currentVersion = dateMap[afterDateIndex].str;
    } else if (afterDateIndex === -1) {
      currentVersion = dateMap[beforeDateIndex].str;
    } else {
      currentVersion = dateMap[timeError ? afterDateIndex : beforeDateIndex].str;
    }

    options = dataSet[currentVersion].options;
    characterData = dataSet[currentVersion].characterData;
    
    // random 40 is first static option
    document.getElementById("pick-random-images").checked = staticOptDecoded[0] === "1";
    // use heap sort is second static option
    document.getElementById("use-heap-sort").checked = staticOptDecoded[1] === "1";

    /** Populate option list and decode options selected. */
    populateOptions();

    let suboptDecodedIndex = 0;
    options.forEach((opt, index) => {
      if ('sub' in opt) {
        const optIsTrue = optDecoded[index] === '1';
        //document.getElementById(`cbgroup-${opt.key}`).checked = optIsTrue;
        opt.sub.forEach((subopt, subindex) => {
          const subIsTrue = optIsTrue ? suboptDecoded[suboptDecodedIndex][subindex] === '1' : true;
          document.getElementById(`cb-${opt.key}-${subindex}`).checked = subIsTrue;
          document.getElementById(`cb-${opt.key}-${subindex}`).disabled = optIsTrue;
        });
        suboptDecodedIndex = suboptDecodedIndex + optIsTrue ? 1 : 0;
      } else { document.getElementById(`cb-${opt.key}`).checked = optDecoded[index] === '1'; }
    });

    successfulLoad = true;
  } catch (err) {
    console.error(`Error loading shareable link: ${err}`);
    setLatestDataset(); // Restore to default function if loading link does not work.
  }

  if (successfulLoad) { start(); }
}

/** 
 * Preloads images in the filtered character data and converts to base64 representation.
*/
function preloadImages() {
  const totalLength = characterDataToSort.length;
  let imagesLoaded = 0;

  if (disablePreload)
  {
    for (let char of characterDataToSort)
    {
      char.img = imageRoot + char.img;
	  }
	  return Promise.resolve();
  }
  else
  {
    const loadImage = async (src) => {
      const blob = await fetch(src).then(res => res.blob());
      return new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = ev => {
          progressBar(`Loading Image ${++imagesLoaded}`, Math.floor(imagesLoaded * 100 / totalLength), null);
          res(ev.target.result);
        };
        reader.onerror = rej;
        reader.readAsDataURL(blob);
      });
    };
    
    return Promise.all(characterDataToSort.map(async (char, idx) => {
      characterDataToSort[idx].img = await loadImage(imageRoot + char.img);
    }));
  }
}

/**
 * Returns a readable time string from milliseconds.
 * 
 * @param {number} milliseconds
 */
function msToReadableTime (milliseconds) {
  let t = Math.floor(milliseconds/1000);
  const years = Math.floor(t / 31536000);
  t = t - (years * 31536000);
  const months = Math.floor(t / 2592000);
  t = t - (months * 2592000);
  const days = Math.floor(t / 86400);
  t = t - (days * 86400);
  const hours = Math.floor(t / 3600);
  t = t - (hours * 3600);
  const minutes = Math.floor(t / 60);
  t = t - (minutes * 60);
  const content = [];
	if (years) content.push(years + " year" + (years > 1 ? "s" : ""));
	if (months) content.push(months + " month" + (months > 1 ? "s" : ""));
	if (days) content.push(days + " day" + (days > 1 ? "s" : ""));
	if (hours) content.push(hours + " hour"  + (hours > 1 ? "s" : ""));
	if (minutes) content.push(minutes + " minute" + (minutes > 1 ? "s" : ""));
	if (t) content.push(t + " second" + (t > 1 ? "s" : ""));
  return content.slice(0,3).join(', ');
}

/**
 * Reduces text to a certain rendered width.
 *
 * @param {string} text Text to reduce.
 * @param {string} font Font applied to text. Example "12px Arial".
 * @param {number} width Width of desired width in px.
 */
function reduceTextWidth(text, font, width) {
  const canvas = reduceTextWidth.canvas || (reduceTextWidth.canvas = document.createElement("canvas"));
  const context = canvas.getContext("2d");
  context.font = font;
  if (context.measureText(text).width < width * 0.8) {
    return text;
  } else {
    let reducedText = text;
    while (context.measureText(reducedText).width + context.measureText('..').width > width * 0.8) {
      reducedText = reducedText.slice(0, -1);
    }
    return reducedText + '..';
  }
}

window.onload = init;
