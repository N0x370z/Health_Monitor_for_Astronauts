// Dominio: pasos del tutorial guiado de cada sección. Cada paso apunta a un elemento real de la pantalla
// (selector CSS). Si el elemento no está visible, el paso se salta.
export const TOURS = {
  heart: [
    { sel: '[data-tour="nav"]', title: "Four sections", body: "Heart monitor, Countermeasures, Daily check-in and Bone density. Each one has its own short tour; reopen it any time with How it works." },
    { sel: '[data-tour="random"]', title: "Load a crew member", body: "Each subject is a real participant of NASA's 70-day bed rest study (CFT70). Random data loads another subject and study day; the check-in starts from zero." },
    { sel: '[data-tour="timeline"]', title: "Travel through the mission", body: "Pre is before bed rest, D7–D70 are days in bed (like days in space) and R+0 / R+3 are the return to gravity. Use ‹ › or Replay." },
    { sel: '[data-tour="pulse"]', title: "Live pulse & oxygen", body: "Marked LIVE SIM: simulated every second, starting from the real heart rate in the database. Everything else is measured echo data." },
    { sel: ".hm-heart svg", title: "Tap a part of the heart", body: "Green Nominal, blue Watch, amber Attention, red Critical. Each region opens its values, what they mean and what to do. Rate & timing shows a live ECG." },
    { sel: ".hm-chart .seg", title: "Your metrics", body: "How each value changed vs. Pre. Switch between All, Size and Flow." },
    { sel: ".tip-nav", title: "Health tips", body: "Advice for the weakest regions. Use the arrows, or swipe on mobile." },
    { sel: ".hm-table", title: "Echocardiography table", body: "Every value at every study day; click a column to jump there. Values in italics were estimated from the same database (hover to see from where)." },
  ],
  counter: [
    { sel: ".kpi-row", title: "What protected the heart", body: "Control (bed rest only) against three exercise programs. Without exercise the left ventricle lost the most muscle." },
    { sel: '.seg[aria-label="Compare timepoint"]', title: "Pick a study day", body: "Compare the groups at any day of bed rest (D7–D70) or of recovery (R+0, R+3)." },
    { sel: ".three", title: "Read the bars", body: "Average change of each group vs. its own Pre value; left of the line means it went down. Under each exercise group, p < 0.05 (green) means the difference with Control is not luck, and g is how big it is." },
    { sel: ".etable.crew", title: "Crew table", body: "The 7-subject crew at day 70. Click a row to open that subject in the Heart monitor." },
  ],
  checkin: [
    { sel: ".two > .card", title: "One minute a day", body: "Mood, stress, energy, connection, sleep and symptoms. Save it to update your week and badges." },
    { sel: ".two > .col > .card", title: "Instant guidance", body: "Your answers turn into advice. Some symptoms, like vision changes, ask you to act now and tell the flight surgeon." },
    { sel: ".two > .col > .card:nth-child(2)", title: "Your week", body: "Last 7 days and badges update as soon as you save. Check-ins stay in this browser; they are not study data." },
  ],
  bone: [
    { sel: '[data-tour="bone-kpis"]', title: "Bone without gravity", body: "DXA scans of 74 bed-rest subjects (NASA). Bones that carry weight lose density; the forearm, which carries no weight, is the control." },
    { sel: '[data-tour="bone-chart"]', title: "Which bones lose density", body: "Average change from Pre to the end of bed rest. The dashed band is the scanner error (LSC): a change inside it is not a real change. Red bars are significant losses." },
    { sel: '[data-tour="bone-params"]', title: "What to watch", body: "The key structures and parameters: BMD as % change from your own Pre value, and the Z-score for young adults." },
    { sel: '[data-tour="bone-subject"]', title: "Pick a subject", body: "Subjects are grouped by bed rest campaign. Campaign 3 and MEDES have before / during / after labels." },
    { sel: '[data-tour="bone-table"]', title: "Subject timeline", body: "% change of BMD at each visit. Amber is a real loss, red a loss twice the scanner error, blue a gain. Hover a cell to see the BMD." },
  ],
};
