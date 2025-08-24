// import PackageUsedModel from "../app/package/package_used/package.used.model";

// // generate trnx id
// export const generateTRNXID = async () => {
//   let isUnique = false;
//   let transactionId;

//   while (!isUnique) {
//     transactionId = ""; // Initialize transactionId

//     const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
//     const length = 10;

//     for (let i = 0; i < length; i++) {
//       const randomIndex = Math.floor(Math.random() * characters.length);
//       transactionId += characters.charAt(randomIndex);
//     }

//     // Check if the generated ID is unique
//     const existingOrder = await PackageUsedModel.findOne({
//       transaction_id: transactionId,
//     });

//     // If no existing order found, mark the ID as unique
//     if (!existingOrder) {
//       isUnique = true;
//     }
//   }

//   return transactionId;
// };
