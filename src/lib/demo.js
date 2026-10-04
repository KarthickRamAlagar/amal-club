// Preview content shown only when Firebase isn't configured yet.
const day = 86400000;
const at = (d, h = 10) => { const t = new Date(Date.now() + d * day); t.setHours(h, 0, 0, 0); return t.getTime(); };
export const DEMO_EVENTS = [
  {
    slug: "mock-parliament-26", name: "Mock Parliament '26", status: "upcoming", startAt: at(9), location: "Amriteshwari Hall",
    shortDesc: "Step into a simulation of the Indian Parliament — debate, draft bills and vote.",
    fullDesc: "The AMAL Mock Parliament is a flagship event designed to simulate the workings of the Indian Parliament, allowing students to experience real policymaking, debate, and leadership in action. Participants take on roles such as MPs, the Speaker, Prime Minister, and the Leader of Opposition.",
    rules: "Teams of 2–4\nFormal attire\nBills must be submitted before the session", price: 200, onlineIntake: 40, onspotIntake: 10, onlineCount: 12, onspotCount: 0,
    teamMin: 2, teamMax: 4, sponsors: [], prizes: "₹12,000 prize pool",
    bannerUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1600&q=85",
  },
  {
    slug: "innovate-x", name: "Innovate X", status: "upcoming", startAt: at(16, 9), location: "ACE Lab",
    shortDesc: "Leadership workshop with ACE — leadership, management and entrepreneurial skills.",
    fullDesc: "An exclusive collaboration between the AMAL Club and ACE (Amrita Centre for Entrepreneurship).", rules: "", price: 0,
    onlineIntake: 80, onspotIntake: 20, onlineCount: 30, onspotCount: 0, teamMin: 1, teamMax: 1, sponsors: [],
    bannerUrl: "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=1600&q=85",
  },
  {
    slug: "management-monopoly", name: "Management Monopoly", status: "disabled", startAt: at(-40, 11), location: "Kalanjali 2025",
    shortDesc: "Management games that tested problem-solving, communication and teamwork.", fullDesc: "", rules: "", price: 0,
    onlineIntake: 30, onspotIntake: 0, onlineCount: 30, onspotCount: 0, teamMin: 3, teamMax: 4, sponsors: [],
    bannerUrl: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=85",
  },
];
export const DEMO_TREE = [
  { uid: "d1", name: "Prof. Sriram Devanathan", role: "admin", designation: "Founder · Faculty Admin", year: "Faculty", email: "" },
  { uid: "d2", name: "Kanishka", role: "president", designation: "President", year: "4th Year", email: "" },
  { uid: "d3", name: "Sanskar Deopuje", role: "vp", designation: "Vice President", year: "3rd Year", email: "" },
  { uid: "d4", name: "Saanvi", role: "vp", designation: "Vice President", year: "3rd Year", email: "" },
  { uid: "d5", name: "Ashrita", role: "treasurer", designation: "Treasurer", year: "3rd Year", email: "" },
  { uid: "d6", name: "Josheni K S", role: "lead", team: "event-management", year: "3rd Year", email: "" },
  { uid: "d7", name: "Dedeepya Kolli", role: "lead", team: "media", year: "3rd Year", email: "" },
  { uid: "d8", name: "Tanvi Reddy", role: "lead", team: "outreach", year: "3rd Year", email: "" },
  { uid: "d9", name: "Jiya Borikar", role: "lead", team: "technical", year: "3rd Year", email: "" },
  { uid: "d10", name: "Niyatee Gamre", role: "lead", team: "documentation", year: "3rd Year", email: "" },
];
