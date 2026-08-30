const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();

exports.listCollections = onRequest({maxInstances: 10}, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  try {
    const collections = await admin.firestore().listCollections();
    const collectionNames = collections.map((col) => col.id);

    logger.info("Fetched collection names successfully", {collectionNames});

    res.status(200).json({success: true, collections: collectionNames});
  } catch (error) {
    logger.error("Error listing collections", error);
    res.status(500).json({success: false, error: error.message});
  }
});
