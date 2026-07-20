// Seeds a demo account with a business profile and ~90 days of reviews so the
// dashboard has data on first run. Log in with demo@reviewpulse.app / demo1234.
//
// Runs only when server/db.json is absent or empty. Once seeded, the data is
// persisted and edited through the app, so re-seeding would overwrite the
// owner's own reviews. Delete server/db.json to get a fresh seed.

import { createUser, createProfile, addReview, getReviews, addStoredResponse, isEmpty } from "./store.js";
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

  // --- 1-star reviews: exercise the low end of the rating filter and push the
  // --- negative sentiment bucket high enough to trip the trend alert.
  [ "Marcus W.", "Worst experience I have had at a restaurant. Rude staff, cold food, and we waited an hour. Never again.", 1, 3, "Yelp" ],
  [ "Angela D.", "Absolutely terrible. My order was wrong twice and the manager was dismissive about it.", 1, 12, "Google" ],
  [ "Frank R.", "Horrible. Dirty table, sticky menus, and the bathroom was disgusting. Walked out before ordering.", 1, 27, "TripAdvisor" ],
  [ "Bethany S.", "Awful service. We were ignored for 25 minutes then told the kitchen was closed. Terrible.", 1, 45, "Yelp" ],
  [ "Curtis N.", "Overpriced and bland. Twenty two dollars for a mediocre plate of pasta. Very disappointing.", 1, 63, "Google" ],

  // --- 4-star: the original seed only had two, so the filter looked broken.
  [ "Renee T.", "Really good food and prompt service. Only knock is parking is tough at peak hours.", 4, 1, "Google" ],
  [ "Jamal B.", "Fresh ingredients and a cozy vibe. Slightly pricey but worth it for a treat.", 4, 5, "TripAdvisor" ],
  [ "Simone P.", "Attentive staff and delicious brunch. Would be five stars if the wait was shorter.", 4, 14, "Facebook" ],
  [ "Wes A.", "Solid. Quick lunch service, affordable, tasty sandwiches. Good value for the area.", 4, 22, "Google" ],
  [ "Lena K.", "Charming decor and friendly staff. Food was tasty though my side was missing.", 4, 34, "Yelp" ],
  [ "Oscar M.", "Great atmosphere for a casual dinner. Fresh salads and reasonable prices.", 4, 50, "TripAdvisor" ],

  // --- last few days, so the 30-day dashboard window is never sparse
  [ "Nadia F.", "The staff was incredibly welcoming and the food came out fast. Best lunch I have had in months.", 5, 0, "Google" ],
  [ "Trevor H.", "Waited 45 minutes for a table with a reservation. Food was fine but the wait time is unacceptable.", 2, 1, "Yelp" ],
  [ "Camila O.", "Cozy ambiance, delicious coffee, sweet staff. My go-to morning spot.", 5, 2, "Facebook" ],
  [ "Priya S.", "Average experience. Nothing stood out either way. Service was prompt at least.", 3, 41, "TripAdvisor" ],
  [ "Bryan L.", "It is okay. Food is decent, prices are a little high for the portion.", 3, 57, "Google" ],

  // --- edge cases: blank name falls back to "Anonymous", a one-word review,
  // --- and a long one that should truncate cleanly in the feed's card layout.
  [ "", "Good.", 4, 7, "Other" ],
  [ "Anonymous", "Fine I guess.", 3, 18, "Other" ],
  [ "Douglas E.", "I have been coming to this place for about three years now and I want to give a full picture rather than just react to one visit. The food has been consistently good, especially the seasonal specials, and the staff genuinely remember regulars by name which counts for a lot. That said, the wait times have crept up noticeably since they expanded the patio, and on two recent visits my food arrived lukewarm rather than hot. The parking situation has always been rough and it has not improved. I still recommend this place to friends, but I tell them to go on a weekday and to plan for a longer meal than they expect. Hoping the kitchen staffing catches up with how popular they have gotten.", 4, 20, "Google" ],
];

// A few already-approved responses so the Responses page has history on first
// run, and so the draft similarity check has something to compare against.
const SEED_RESPONSES = [
  [ "Maria G.", "Thank you so much for the kind words, Maria! We are thrilled the brunch and the service hit the mark. Our team will be delighted to hear this. See you next time!" ],
  [ "James T.", "We are really sorry about the long wait and the cold soup, James. That is not the standard we hold ourselves to. We have added staff to the weekend kitchen since your visit and would love another chance to get it right." ],
  [ "Kevin O.", "We are really sorry about the service you received, Kevin. Being made to feel like a bother is never acceptable. We have addressed this directly with our floor team and would appreciate the chance to make it up to you." ],
];

export async function seedDemoData() {
  if (!isEmpty()) return null; // existing database loaded from disk — leave it alone

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
  const byReviewer = new Map(getReviews(profile.businessId).map((r) => [r.reviewerName, r]));
  for (const [reviewerName, responseText] of SEED_RESPONSES) {
    const review = byReviewer.get(reviewerName);
    if (review) addStoredResponse(review.reviewId, profile.businessId, responseText);
  }

  await runAnalysis(profile.businessId);
  return { user, profile };
}
