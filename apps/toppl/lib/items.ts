export type Item = {
  id: string;
  prompt: string;
  value: number;
  unit: string;
  category: string;
  source?: string;
};

// Phase 1: hand-curated. Phase 2 swaps this for Supabase + LLM batches.
// Values are rough-order-of-magnitude correct. Comparisons pick pairs with
// at least a 1.5x value gap so it's never a pure coin flip.
export const ITEMS: Item[] = [
  // celebrities
  { id: "tay-ig", prompt: "Taylor Swift Instagram followers", value: 283_000_000, unit: "followers", category: "Pop Culture" },
  { id: "cr-ig", prompt: "Cristiano Ronaldo Instagram followers", value: 643_000_000, unit: "followers", category: "Pop Culture" },
  { id: "srk-ig", prompt: "Shah Rukh Khan Instagram followers", value: 47_000_000, unit: "followers", category: "Pop Culture" },
  { id: "drake-songs", prompt: "Songs Drake has released", value: 300, unit: "songs", category: "Pop Culture" },
  { id: "swift-songs", prompt: "Songs Taylor Swift has released", value: 240, unit: "songs", category: "Pop Culture" },

  // sports
  { id: "sachin-runs", prompt: "Career international runs by Sachin Tendulkar", value: 34_357, unit: "runs", category: "Sports" },
  { id: "kohli-runs", prompt: "Career international runs by Virat Kohli", value: 27_500, unit: "runs", category: "Sports" },
  { id: "msg-sixes", prompt: "Sixes hit by MS Dhoni in IPL career", value: 240, unit: "sixes", category: "Sports" },
  { id: "ipl-sixes-season", prompt: "Sixes hit across an entire IPL season", value: 1100, unit: "sixes", category: "Sports" },

  // cities & populations
  { id: "mumbai-pop", prompt: "Population of Mumbai metro area", value: 21_700_000, unit: "people", category: "Geography" },
  { id: "tokyo-pop", prompt: "Population of Tokyo metro area", value: 37_400_000, unit: "people", category: "Geography" },
  { id: "iceland-pop", prompt: "Population of Iceland", value: 380_000, unit: "people", category: "Geography" },
  { id: "nz-pop", prompt: "Population of New Zealand", value: 5_200_000, unit: "people", category: "Geography" },
  { id: "nyc-pigeons", prompt: "Estimated pigeons in New York City", value: 1_000_000, unit: "birds", category: "Geography" },
  { id: "uber-london", prompt: "Active Uber drivers in London", value: 50_000, unit: "drivers", category: "Industry & Trade" },

  // structures
  { id: "eiffel-steps", prompt: "Steps to the top of the Eiffel Tower", value: 1665, unit: "steps", category: "Geography" },
  { id: "empire-floors", prompt: "Floors in the Empire State Building", value: 102, unit: "floors", category: "Geography" },
  { id: "burj-floors", prompt: "Floors in the Burj Khalifa", value: 163, unit: "floors", category: "Geography" },
  { id: "taj-tourists", prompt: "Daily visitors to the Taj Mahal", value: 22_000, unit: "people", category: "Geography" },

  // food & drink
  { id: "bigmac-cal", prompt: "Calories in a McDonald's Big Mac", value: 563, unit: "calories", category: "Food & Drink" },
  { id: "starbucks-pumpkin", prompt: "Calories in a Grande Pumpkin Spice Latte", value: 390, unit: "calories", category: "Food & Drink" },
  { id: "mcd-stores", prompt: "McDonald's restaurants worldwide", value: 41_000, unit: "stores", category: "Industry & Trade" },
  { id: "sbux-stores", prompt: "Starbucks locations worldwide", value: 38_000, unit: "stores", category: "Industry & Trade" },
  { id: "italy-coffee", prompt: "Coffee cups consumed in Italy per day", value: 95_000_000, unit: "cups", category: "Food & Drink" },
  { id: "uk-tea", prompt: "Tea cups consumed in the UK per day", value: 100_000_000, unit: "cups", category: "Food & Drink" },
  { id: "india-chai", prompt: "Cups of chai consumed in India per day", value: 1_400_000_000, unit: "cups", category: "Food & Drink" },

  // tech
  { id: "iphone-day", prompt: "iPhones sold worldwide per day on average", value: 600_000, unit: "phones", category: "Technology" },
  { id: "tesla-day", prompt: "Teslas produced worldwide per day", value: 5_000, unit: "cars", category: "Technology" },
  { id: "wiki-edits-min", prompt: "Wikipedia edits made per minute", value: 350, unit: "edits", category: "Technology" },
  { id: "tiktok-uploads", prompt: "TikTok videos uploaded per minute", value: 34_000, unit: "videos", category: "Technology" },
  { id: "google-searches-sec", prompt: "Google searches per second", value: 99_000, unit: "searches", category: "Technology" },

  // money
  { id: "powerball-jackpot", prompt: "Largest Powerball jackpot in history (USD)", value: 2_040_000_000, unit: "dollars", category: "Money" },
  { id: "us-coffee-mkt", prompt: "Annual US coffee market value (USD)", value: 90_000_000_000, unit: "dollars", category: "Money" },
  { id: "indian-wedding", prompt: "Average cost of an Indian wedding (INR)", value: 2_000_000, unit: "rupees", category: "Money" },

  // nature
  { id: "blue-whale-heart", prompt: "Weight of a blue whale's heart in kilograms", value: 180, unit: "kg", category: "Biology" },
  { id: "human-heart", prompt: "Weight of an adult human heart in grams", value: 310, unit: "grams", category: "Biology" },
  { id: "elephant-day-food", prompt: "Food eaten by an adult elephant per day in kg", value: 150, unit: "kg", category: "Biology" },
  { id: "ant-weight-mg", prompt: "Weight of a typical ant in milligrams", value: 4, unit: "mg", category: "Biology" },

  // weird scale
  { id: "lego-second", prompt: "Lego bricks manufactured per second", value: 1140, unit: "bricks", category: "Industry & Trade" },
  { id: "blink-day", prompt: "Times the average person blinks per day", value: 28_800, unit: "blinks", category: "Human Behavior" },
];
