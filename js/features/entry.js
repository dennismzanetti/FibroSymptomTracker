function setupExerciseToggle() {
  const didExerciseInput = document.getElementById("didExerciseInput");
  const exerciseDetails  = document.getElementById("exerciseDetails");
  if (!didExerciseInput || !exerciseDetails) return;

  function update() {
    exerciseDetails.style.display = didExerciseInput.value === "yes" ? "" : "none";
  }
  didExerciseInput.addEventListener("change", update);
  update();
}

function collectEntry() {
  function val(id)  { const el = document.getElementById(id); return el ? el.value.trim() : ""; }
  function num(id)  { const v = parseFloat(val(id)); return isNaN(v) ? null : v; }
  function check(id){ const el = document.getElementById(id); return el ? el.checked : false; }

  const tags = Array.from(
    document.querySelectorAll('#tagsContainer input[type="checkbox"]:checked')
  ).map(cb => cb.value);

  return {
    dayTitle:       val("dayTitleInput"),
    overallNotes:   val("overallNotesInput"),
    moodScore:      num("moodScoreInput"),
    moodNotes:      val("moodNotesInput"),
    earlyMorning:   { score: num("earlyMorningScore"),     activity: val("earlyMorningActivity"),     symptoms: val("earlyMorningSymptoms") },
    lateMorning:    { score: num("lateMorningScore"),      activity: val("lateMorningActivity"),      symptoms: val("lateMorningSymptoms") },
    earlyAfternoon: { score: num("earlyAfternoonScore"),   activity: val("earlyAfternoonActivity"),   symptoms: val("earlyAfternoonSymptoms") },
    lateAfternoon:  { score: num("lateAfternoonScore"),    activity: val("lateAfternoonActivity"),    symptoms: val("lateAfternoonSymptoms") },
    earlyEvening:   { score: num("earlyEveningScore"),     activity: val("earlyEveningActivity"),     symptoms: val("earlyEveningSymptoms") },
    lateEvening:    { score: num("lateEveningScore"),      activity: val("lateEveningActivity"),      symptoms: val("lateEveningSymptoms") },
    painScore:      num("painScoreInput"),
    painNotes:      val("painNotesInput"),
    fatigueScore:   num("fatigueScoreInput"),
    fatigueNotes:   val("fatigueNotesInput"),
    bedtime:        val("bedtimeInput"),
    wakeTime:       val("wakeTimeInput"),
    hoursSlept:     num("hoursSleptInput"),
    sleepQuality:   num("sleepQualityInput"),
    awakenings:     num("awakeningsInput"),
    sleepNotes:     val("sleepNotesInput"),
    didExercise:    val("didExerciseInput"),
    exerciseType:   val("exerciseTypeInput"),
    exerciseMinutes:num("exerciseMinutesInput"),
    exerciseIntensity: val("exerciseIntensityInput"),
    exerciseTiming: val("exerciseTimingInput"),
    exerciseNotes:  val("exerciseNotesInput"),
    water:          num("waterInput"),
    nutritionNotes: val("nutritionNotesInput"),
    tags,
  };
}

function populateEntry(data) {
  if (!data) return;
  function set(id, v) { const el = document.getElementById(id); if (el && v != null) el.value = v; }
  function setCheck(container, values) {
    document.querySelectorAll(`#${container} input[type="checkbox"]`).forEach(cb => {
      cb.checked = Array.isArray(values) && values.includes(cb.value);
    });
  }

  set("dayTitleInput",     data.dayTitle);
  set("overallNotesInput", data.overallNotes);
  set("moodScoreInput",    data.moodScore);
  set("moodNotesInput",    data.moodNotes);

  const blocks = [
    ["earlyMorning",   "earlyMorningScore",     "earlyMorningActivity",     "earlyMorningSymptoms"],
    ["lateMorning",    "lateMorningScore",      "lateMorningActivity",      "lateMorningSymptoms"],
    ["earlyAfternoon", "earlyAfternoonScore",   "earlyAfternoonActivity",   "earlyAfternoonSymptoms"],
    ["lateAfternoon",  "lateAfternoonScore",    "lateAfternoonActivity",    "lateAfternoonSymptoms"],
    ["earlyEvening",   "earlyEveningScore",     "earlyEveningActivity",     "earlyEveningSymptoms"],
    ["lateEvening",    "lateEveningScore",      "lateEveningActivity",      "lateEveningSymptoms"],
  ];
  blocks.forEach(([key, scoreId, actId, symId]) => {
    const b = data[key] || {};
    set(scoreId, b.score);
    set(actId,   b.activity);
    set(symId,   b.symptoms);
  });

  set("painScoreInput",   data.painScore);
  set("painNotesInput",   data.painNotes);
  set("fatigueScoreInput",data.fatigueScore);
  set("fatigueNotesInput",data.fatigueNotes);
  set("bedtimeInput",     data.bedtime);
  set("wakeTimeInput",    data.wakeTime);
  set("sleepQualityInput",data.sleepQuality);
  set("awakeningsInput",  data.awakenings);
  set("sleepNotesInput",  data.sleepNotes);

  // Trigger recalc for sleep display
  const bedEl = document.getElementById('bedtimeInput');
  if (bedEl) bedEl.dispatchEvent(new Event('change'));

  set("didExerciseInput",     data.didExercise);
  set("exerciseTypeInput",    data.exerciseType);
  set("exerciseMinutesInput", data.exerciseMinutes);
  set("exerciseIntensityInput",data.exerciseIntensity);
  set("exerciseTimingInput",  data.exerciseTiming);
  set("exerciseNotesInput",   data.exerciseNotes);

  // Trigger exercise toggle
  const exEl = document.getElementById('didExerciseInput');
  if (exEl) exEl.dispatchEvent(new Event('change'));

  set("waterInput",         data.water);
  set("nutritionNotesInput",data.nutritionNotes);

  setCheck("tagsContainer", data.tags);
}

function clearEntry() {
  document.querySelectorAll(
    '#entry-tab input[type="number"], #entry-tab input[type="text"], #entry-tab input[type="time"], #entry-tab textarea'
  ).forEach(el => { el.value = ''; });
  document.querySelectorAll('#tagsContainer input[type="checkbox"]').forEach(cb => { cb.checked = false; });

  const didExEl = document.getElementById('didExerciseInput');
  if (didExEl) { didExEl.value = 'no'; didExEl.dispatchEvent(new Event('change')); }

  const hoursDisp = document.getElementById('hoursSleptDisplay');
  if (hoursDisp) hoursDisp.textContent = '\u2014';
}
