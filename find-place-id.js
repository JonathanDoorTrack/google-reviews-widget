require('dotenv').config();

fetch(`https://places.googleapis.com/v1/places/${process.env.GOOGLE_PLACE_ID}`, {
  headers: {
    'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
    'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount,reviews',
  },
})
  .then((r) => r.json())
  .then((d) => console.log(JSON.stringify(d, null, 2)))
  .catch(console.error);
