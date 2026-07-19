// Seeds a demo account with a business profile and ~90 days of reviews so the
// dashboard has data on first run. Log in with demo@reviewpulse.app / demo1234.

import { createUser, createProfile, addReview } from "./store.js";
import { runAnalysis } from "./analysis.js";

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const SEED_REVIEWS = [
  [ "Maria G.", "Absolutely delicious food and the staff was so friendly. Our server checked on us constantly. Best brunch spot in town!", 5, 2, "Google" ],
  [ "James T.", "Waited 45 minutes for our entrees and my soup arrived cold. Really disappointing since the reviews were so good.", 2, 4, "Yelp" ],
  [ "Alicia R.", "Cozy atmosphere and great value for the portion sizes. The decor is charming. Will definitely be back.", 5, 6, "Google" ],
  [ "Derek P.", "Food was fine but parking is a nightmare. Circled the block three times before finding a spot.", 3, 8, "Google" ],
  [ "Sandra L.", "The staff went above and beyond for my mom's birthday. So welcoming and kind. Incredible experience.", 5, 9, "Facebook" ],
  [ "Kevin O.", "Server was rude and seemed annoyed when we asked for refills. The food couldn't make up for the attitude.", 2, 11, "Yelp" ],
  [ "Priya N.", "Fresh ingredients, flavorful dishes, quick service. Everything you want. Highly recommend the salmon.", 5, 13, "Google" ],
  [ "Tom W.", "Decent spot. Nothing amazing but nothing terrible either. Prices felt a little high for what you get.", 3, 15, "Google" ],
  [ "Rachel B.", "They forgot my side dish and the burger came out wrong. Staff fixed it but it took a while.", 2, 17, "Yelp" ],
  [ "Luis M.", "Amazing food, great atmosphere, friendly staff. The trifecta. My new favorite lunch spot.", 5, 19, "Google" ],
  [ "Hannah K.", "The wait was way too long for a Tuesday night. Food was tasty once it finally arrived though.", 3, 21, "Google" ],
  [ "Greg S.", "Overpriced and underwhelming. My pasta was bland and lukewarm. Expected more from the hype.", 2, 24, "Yelp" ],
  [ "Nicole F.", "Such a warm staff and cozy vibe. Perfect date night spot. The dessert menu is incredible.", 5, 26, "Facebook" ],
  [ "Brian C.", "Quick, friendly, delicious. In and out on my lunch break with time to spare. Speedy service!", 5, 28, "Google" ],
  [ "Dana V.", "Bathroom was dirty and the table felt sticky. Food was okay but cleanliness matters to me.", 2, 31, "Yelp" ],
  [ "Omar H.", "Great value lunch specials. Affordable, filling, and fresh. Worth every penny.", 4, 33, "Google" ],
  [ "Jess W.", "Waited forever to get seated even with a reservation. The hostess ignored us for ten minutes.", 2, 36, "Yelp" ],
  [ "Carlos D.", "The atmosphere is wonderful and the staff remembers our names. Feels like family. Love this place.", 5, 38, "Google" ],
  [ "Emily A.", "My food arrived cold for the second visit in a row. Something changed in the kitchen recently.", 2, 40, "Google" ],
  [ "Steve R.", "Solid neighborhood spot. Portions are reasonable and service is prompt. No complaints.", 4, 43, "Google" ],
  [ "Megan J.", "Best breakfast in the area, hands down. Friendly faces every single time. Perfect eggs benedict.", 5, 46, "Yelp" ],
  [ "Paul E.", "Parking situation is terrible and the lot fills up by 11am. Food is good but plan ahead.", 3, 49, "Google" ],
  [ "Tina Q.", "Server mixed up our order and we got charged for the wrong items. Manager fixed it but frustrating.", 2, 52, "Yelp" ],
  [ "Andre B.", "Delicious food and wonderful service. The seasonal menu keeps things interesting. Highly recommend.", 5, 55, "Google" ],
  [ "Kelly M.", "It was fine. Average food, average service. Probably wouldn't go out of my way to return.", 3, 58, "Facebook" ],
  [ "Victor S.", "The new patio seating is fantastic. Great atmosphere for a weekend brunch with friends.", 5, 61, "Google" ],
  [ "Laura H.", "Too expensive for the portion size. $18 for a small sandwich and a handful of chips.", 2, 64, "Yelp" ],
  [ "Nathan G.", "Staff was incredibly attentive and the kitchen was fast. Excellent experience from start to finish.", 5, 67, "Google" ],
  [ "Sophie T.", "Slow service again. Kitchen seems understaffed on weekends. 40 minute wait for appetizers.", 2, 70, "Google" ],
  [ "Marcus L.", "Fresh, flavorful, and reasonably priced. This place deserves more attention. A hidden gem.", 5, 73, "Yelp" ],
  [ "Grace P.", "Lovely cozy ambiance and the best coffee around. Staff is always so sweet to my kids.", 5, 76, "Google" ],
  [ "Ethan Y.", "Mediocre at best. My steak was overcooked and the waiter never came back to check on us.", 2, 79, "Yelp" ],
  [ "Olivia C.", "Wonderful spot for a quiet dinner. Excellent wine list and the staff is knowledgeable and warm.", 5, 82, "Google" ],
  [ "Ryan K.", "Good food but the wait time keeps getting worse. Used to be quick, now it's 30+ minutes every visit.", 3, 85, "Google" ],
  [ "Isabel M.", "Perfect anniversary dinner. The chef even sent out a complimentary dessert. Amazing hospitality.", 5, 88, "Facebook" ],
];

export async function seedDemoData() {
  const user = createUser("demo@reviewpulse.app", "demo1234");
  const profile = createProfile(user.userId, {
    name: "The Copper Kettle Cafe",
    type: "Restaurant",
    description: "A neighborhood cafe serving brunch, lunch, and dinner with locally sourced ingredients.",
    toneProfile: "Friendly",
    responseLength: "Medium",
  });
  for (const [reviewerName, reviewText, starRating, ago, platformSource] of SEED_REVIEWS) {
    addReview(profile.businessId, {
      reviewerName,
      reviewText,
      starRating,
      reviewDate: daysAgo(ago),
      platformSource,
    });
  }
  await runAnalysis(profile.businessId);
  return { user, profile };
}
