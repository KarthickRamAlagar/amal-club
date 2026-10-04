import { handler, authed, snap, RANK } from "../_lib/admin.js";
import { runPrediction } from "../_lib/predict.js";

export default handler(async (req) => {
  const { member } = await authed(req);
  if ((RANK[member.role] || 0) < 40) throw Object.assign(new Error("Only Admin, Club Representatives and Team Leads can run predictions."), { status: 403 });
  const { eventId } = req.body || {};
  if (!eventId) throw Object.assign(new Error("eventId required"), { status: 400 });
  return { prediction: await runPrediction(eventId, snap(member)) };
});
