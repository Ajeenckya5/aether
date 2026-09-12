export type CoachBlock = {
  title: string;
  seconds: number;
  cue: string;
};

export type CoachSession = {
  slug: string;
  title: string;
  kicker: string;
  durationMin: number;
  level: "Recover" | "Build" | "Push";
  sport: string;
  summary: string;
  video: string;
  poster: string;
  blocks: CoachBlock[];
};

export const COACH_SESSIONS: CoachSession[] = [
  {
    slug: "sunrise-mobility",
    title: "Sunrise Mobility",
    kicker: "Open the day",
    durationMin: 12,
    level: "Recover",
    sport: "yoga",
    summary:
      "A slow joint sequence for stiff mornings. Hips, T-spine, and breath before any load.",
    video:
      "https://videos.pexels.com/video-files/3822145/3822145-sd_640_360_30fps.mp4",
    poster:
      "https://images.pexels.com/photos/3822622/pexels-photo-3822622.jpeg?auto=compress&cs=tinysrgb&w=1400",
    blocks: [
      { title: "Breath", seconds: 90, cue: "Nasal inhale for 4, long exhale for 6." },
      { title: "Cat-cow", seconds: 120, cue: "Move with the breath. Keep the neck long." },
      { title: "World's greatest", seconds: 180, cue: "Hip to heel. Rotate the chest open." },
      { title: "90/90 switches", seconds: 150, cue: "Tall spine. Don't collapse the ribs." },
      { title: "Down dog to walk-out", seconds: 120, cue: "Soft knees. Push the floor away." },
      { title: "Stillness", seconds: 60, cue: "Close the eyes. Notice the pulse in the hands." },
    ],
  },
  {
    slug: "ember-zone-two",
    title: "Ember Zone Two",
    kicker: "Aerobic base",
    durationMin: 40,
    level: "Build",
    sport: "running",
    summary:
      "Conversational pace only. You should be able to speak a full sentence. Heart rate stays in zone 2.",
    video:
      "https://videos.pexels.com/video-files/4753989/4753989-sd_640_360_30fps.mp4",
    poster:
      "https://images.pexels.com/photos/2803158/pexels-photo-2803158.jpeg?auto=compress&cs=tinysrgb&w=1400",
    blocks: [
      { title: "Easy roll-in", seconds: 300, cue: "Shuffle. Let cadence find you." },
      { title: "Zone two", seconds: 1500, cue: "Nose breathing if you can. Unclench the jaw." },
      { title: "Stride openers", seconds: 180, cue: "Four relaxed 20-second pickups." },
      { title: "Settle", seconds: 420, cue: "Drop back to easy. Finish smoother than you started." },
    ],
  },
  {
    slug: "iron-circuit",
    title: "Iron Circuit",
    kicker: "Full body strength",
    durationMin: 28,
    level: "Push",
    sport: "weightlifting",
    summary:
      "Five rounds. Hinge, squat, push, pull. Leave two reps in the tank on every set.",
    video:
      "https://videos.pexels.com/video-files/5327468/5327468-sd_640_360_25fps.mp4",
    poster:
      "https://images.pexels.com/photos/1552249/pexels-photo-1552249.jpeg?auto=compress&cs=tinysrgb&w=1400",
    blocks: [
      { title: "Warm the pattern", seconds: 180, cue: "Bodyweight squat, hip hinge, scap push-up." },
      { title: "Goblet squat", seconds: 240, cue: "Elbows inside the knees. Pause one second." },
      { title: "Romanian deadlift", seconds: 240, cue: "Push the floor. Soft knees. Long spine." },
      { title: "Floor press", seconds: 240, cue: "Upper back tight. Don't bounce the elbows." },
      { title: "Row", seconds: 240, cue: "Pull to the hip. Pause. Lower slower than you lifted." },
      { title: "Carry", seconds: 180, cue: "Heavy suitcase carry. Ribs stacked over pelvis." },
      { title: "Downshift", seconds: 160, cue: "Walk, breathe, shake the legs out." },
    ],
  },
  {
    slug: "tide-breath",
    title: "Tide Breath",
    kicker: "Nervous system",
    durationMin: 15,
    level: "Recover",
    sport: "pilates",
    summary:
      "Down-regulation after a hard day. No strain target. Longer exhales, heavy limbs.",
    video:
      "https://videos.pexels.com/video-files/3822145/3822145-sd_640_360_30fps.mp4",
    poster:
      "https://images.pexels.com/photos/3822622/pexels-photo-3822622.jpeg?auto=compress&cs=tinysrgb&w=1400",
    blocks: [
      { title: "Arrive", seconds: 120, cue: "Lie down. Feel the weight of the skull." },
      { title: "Box breath", seconds: 240, cue: "In 4, hold 4, out 4, hold 4." },
      { title: "Physiological sigh", seconds: 180, cue: "Double inhale through the nose, long mouth exhale." },
      { title: "Body scan", seconds: 240, cue: "From the toes up. Soften whatever you find." },
      { title: "Sit up slow", seconds: 120, cue: "Roll to one side. Pause before standing." },
    ],
  },
  {
    slug: "hill-repeats",
    title: "Hill Repeats",
    kicker: "Power endurance",
    durationMin: 32,
    level: "Push",
    sport: "running",
    summary:
      "Short climbs at a hard but repeatable effort. Walk the downs. Don't sprint the first rep.",
    video:
      "https://videos.pexels.com/video-files/4828054/4828054-sd_640_360_24fps.mp4",
    poster:
      "https://images.pexels.com/photos/1365425/pexels-photo-1365425.jpeg?auto=compress&cs=tinysrgb&w=1400",
    blocks: [
      { title: "Warm jog", seconds: 360, cue: "Easy until you feel a light sweat." },
      { title: "Repeat 1", seconds: 90, cue: "Strong posture. Drive the knee, don't collapse." },
      { title: "Walk down", seconds: 90, cue: "Shake the arms. Reset the breath." },
      { title: "Repeat 2", seconds: 90, cue: "Same effort as rep one. Don't chase it." },
      { title: "Walk down", seconds: 90, cue: "Nasal breathing if you can." },
      { title: "Repeat 3", seconds: 90, cue: "Stay tall at the top." },
      { title: "Walk down", seconds: 90, cue: "Let the heart rate come to you." },
      { title: "Repeat 4", seconds: 90, cue: "Last hard one. Smooth, not sloppy." },
      { title: "Cool walk", seconds: 420, cue: "No stretching yet. Just easy walking." },
    ],
  },
  {
    slug: "recovery-walk",
    title: "Recovery Walk",
    kicker: "Active rest",
    durationMin: 25,
    level: "Recover",
    sport: "walking",
    summary:
      "Easy outdoor walk. Phone in a pocket. Let yesterday's strain drain out of the legs.",
    video:
      "https://videos.pexels.com/video-files/4322002/4322002-sd_640_360_25fps.mp4",
    poster:
      "https://images.pexels.com/photos/1571939/pexels-photo-1571939.jpeg?auto=compress&cs=tinysrgb&w=1400",
    blocks: [
      { title: "Loosen", seconds: 180, cue: "Ankles, shoulders, unclench the hands." },
      { title: "Easy walk", seconds: 1020, cue: "Look farther ahead than usual." },
      { title: "Nasal finish", seconds: 300, cue: "Close the mouth. Slow the steps." },
    ],
  },
  {
    slug: "floor-strength",
    title: "Floor Strength",
    kicker: "No equipment",
    durationMin: 24,
    level: "Build",
    sport: "functional-fitness",
    summary:
      "Push-ups, split squats, hollow holds. For hotel rooms, living rooms, and bad weather.",
    video:
      "https://videos.pexels.com/video-files/8093156/8093156-sd_640_360_25fps.mp4",
    poster:
      "https://images.pexels.com/photos/416778/pexels-photo-416778.jpeg?auto=compress&cs=tinysrgb&w=1400",
    blocks: [
      { title: "Prep", seconds: 120, cue: "Shoulder circles, glute bridges, dead bugs." },
      { title: "Split squat", seconds: 240, cue: "Back knee kisses the floor. Front heel heavy." },
      { title: "Push-up", seconds: 240, cue: "Body one piece. Stop one rep before failure." },
      { title: "Posterior plank", seconds: 180, cue: "Squeeze glutes. Don't hang off the shoulders." },
      { title: "Reverse lunge", seconds: 240, cue: "Slow down. Quiet feet." },
      { title: "Hollow + rest", seconds: 240, cue: "Low back glued. Breathe into the ribs." },
      { title: "Walk it off", seconds: 180, cue: "Easy walking in place. Long exhales." },
    ],
  },
  {
    slug: "night-unwind",
    title: "Night Unwind",
    kicker: "Pre-sleep",
    durationMin: 10,
    level: "Recover",
    sport: "yoga",
    summary:
      "Lights low. No strain. Forward folds and longer exhales so sleep onset is easier.",
    video:
      "https://videos.pexels.com/video-files/3822145/3822145-sd_640_360_30fps.mp4",
    poster:
      "https://images.pexels.com/photos/3822622/pexels-photo-3822622.jpeg?auto=compress&cs=tinysrgb&w=1400",
    blocks: [
      { title: "Dim", seconds: 60, cue: "Sit. Drop the shoulders." },
      { title: "Seated fold", seconds: 150, cue: "Bend the knees as much as you need." },
      { title: "Supine twist", seconds: 180, cue: "Both shoulders heavy. Don't force the knee." },
      { title: "Legs on the wall", seconds: 150, cue: "Let the thighs go heavy." },
      { title: "Dark", seconds: 60, cue: "Lights out after this. No phone." },
    ],
  },
];

export function coachBySlug(slug: string): CoachSession | undefined {
  return COACH_SESSIONS.find((s) => s.slug === slug);
}
