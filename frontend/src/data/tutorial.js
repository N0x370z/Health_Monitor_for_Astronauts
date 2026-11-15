// Contenido del mini tutorial por sección y cuándo mostrarlo.
// Se abre solo la primera vez que se visita cada sección; lo visto se recuerda en el navegador.
import { useEffect, useState } from "react";

export const TOURS = {
  heart: {
    title: "Heart monitor",
    steps: [
      { icon: "user", title: "Pick a subject", text: "Each subject is a real participant of NASA's 70-day bed rest study (CFT70). Choose one in the sidebar, or press Random data to load any subject and timepoint." },
      { icon: "calendar", title: "Move through the mission", text: "Pre is the baseline before bed rest. D7 to D70 are days in bed rest (like days in space) and R+0 / R+3 are the return to gravity. Use the arrows or ▶ Replay to watch the heart change." },
      { icon: "heartLine", title: "Read the heart", text: "The heart is split into 5 regions. Green is Nominal, blue is Watch, amber is Attention and red is Critical. Tap a region to see its values, what they mean and what to do." },
      { icon: "list", title: "Findings and actions", text: "Findings lists every value out of range or changing too fast, with the recommended action. Full report builds a summary for the flight surgeon." },
      { icon: "chart", title: "Trends and echo table", text: "Your metrics shows the % change from Pre over time (All, Size or Flow). The Echocardiography table shows every value at every timepoint; click a column to jump to it." },
      { icon: "activity", title: "Live vs. measured", text: "Pulse and SpO₂ marked LIVE SIM are simulated every second (the pulse starts from the measured value). Everything else is real echo data. The header says if it comes Live from the database or Offline from the bundled files." },
    ],
  },
  counter: {
    title: "Countermeasures",
    steps: [
      { icon: "dumbbell", title: "What protects the heart", text: "This screen compares the 4 study groups: Control (bed rest only) and three exercise programs (Exercise A, Exercise B and Flywheel)." },
      { icon: "chart", title: "Read the bars", text: "Each bar is the average change of a group versus its own Pre value. Left of the line means the value went down. Pick a timepoint (D7 … R+3) above the charts." },
      { icon: "bulb", title: "Is the difference real?", text: "Under each exercise group, p is the chance that the difference with Control is luck (p < 0.05, in green, means it is significant) and g is how big the effect is (0.8 or more is large). They appear when the data comes Live from the database." },
      { icon: "user", title: "Crew table", text: "The 7-subject crew at day 70 with their heart score, LV mass change and heart rate. Click a row to open that subject in the Heart monitor." },
    ],
  },
  checkin: {
    title: "Daily check-in",
    steps: [
      { icon: "pen", title: "One minute a day", text: "Tell us how you feel: mood, stress, energy, connection with crew and family, sleep and any symptoms. A dot in the menu reminds you while today's check-in is pending." },
      { icon: "alert", title: "Instant guidance", text: "What this means turns your answers into advice. Some symptoms, like vision changes, ask you to act now and tell the flight surgeon." },
      { icon: "shield", title: "Private by design", text: "Check-ins stay in this browser only. They are not part of the NASA study data and are never sent to the server." },
    ],
  },
};

const seenKey = (tab) => `orbitcare.tour.${tab}`;
const wasSeen = (tab) => {
  try { return localStorage.getItem(seenKey(tab)) === "1"; } catch { return false; }
};
const markSeen = (tab) => {
  try { localStorage.setItem(seenKey(tab), "1"); } catch { /* sin storage: se mostrará otra vez */ }
};

/** Abre el tutorial de la sección la primera vez que se visita. */
export function useTutorial(tab) {
  const [open, setOpen] = useState(null);
  useEffect(() => {
    if (TOURS[tab] && !wasSeen(tab)) setOpen(tab);
  }, [tab]);
  return {
    open,
    show: () => setOpen(tab),
    close: () => { if (open) markSeen(open); setOpen(null); },
  };
}
