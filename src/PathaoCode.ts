// export const getACustomerAllOrder: RequestHandler = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<IOrderInterface | any> => {
//   try {
//     const response = await fetch(
//       "https://api-hermes.pathao.com/aladdin/api/v1/issue-token",
//       {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           client_id: "8mepZDpbMy", // Replace with actual client_id
//           client_secret: "GaE4FmJo3SEHSN04r2owFOdID4H9u6SPO9kQJYKQ", // Replace with actual client_secret
//           grant_type: "password",
//           username: "mumufariha21@gmail.com", // Replace with your email
//           password: "Aa95580", // Replace with your password
//         }),
//       }
//     );

//     const result = await response.json();
    // console.log(result);

    // // city data
    // const cityData = await fetch(
    //   "https://api-hermes.pathao.com/aladdin/api/v1/city-list",
    //   {
    //     method: "get",
    //     headers: {
    //       "Content-Type": "application/json",
    //       Authorization: `Bearer ${result?.access_token}`, // Replace access_token with actual token
    //     },
    //   }
    // );

    // // Parse cityData
    // const cityResult = await cityData.json();
    // console.log(cityResult?.data?.data);

    // // store data
    // const storeData = await fetch(
    //   "https://api-hermes.pathao.com/aladdin/api/v1/stores",
    //   {
    //     method: "get",
    //     headers: {
    //       "Content-Type": "application/json",
    //       Authorization: `Bearer ${result?.access_token}`, // Replace access_token with actual token
    //     },
    //   }
    // );

    // // Parse storeData
    // const storeResult = await storeData.json();
    // console.log(storeResult?.data?.data);
    // return sendResponse<any>(res, {
    //   statusCode: httpStatus.OK,
    //   success: true,
    //   message: "Order Found Successfully !",
    //   data: storeResult?.data?.data,
    // });

    // const data = {
    //   store_id: 148424, // Replace with actual store ID (number)
    //   merchant_order_id: "12563", // Replace with actual order ID (string)
    //   recipient_name: "Nazmul 2",
    //   recipient_phone: "01885107155", // Replace with actual phone number
    //   recipient_address: `Noakhali, Bangladesh`,
    //   recipient_city: 1, // Replace with actual city ID (number)
    //   recipient_zone: 298, // Replace with actual zone ID (number)
    //   delivery_type: 12,
    //   item_type: 2,
    //   item_quantity: 1,
    //   item_weight: "1",
    //   amount_to_collect: 650,
    // };

    // const createOrder = await fetch(
    //   "https://api-hermes.pathao.com/aladdin/api/v1/orders",
    //   {
    //     method: "POST",
    //     headers: {
    //       "Content-Type": "application/json",
    //       Authorization: `Bearer ${result?.access_token}`, // Replace access_token with actual token
    //     },
    //     body: JSON.stringify(data),
    //   }
    // );

    // // Parse createOrder
    // const orderResult = await createOrder.json();
    // console.log(orderResult);
//       } catch (error: any) {
//     next(error);
//   }
// };





// export const getZoneData: RequestHandler = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<any> => {
//   try {
//     const { city_id } = req.query;
//     if (!city_id) {
//       return sendResponse(res, {
//         statusCode: httpStatus.BAD_REQUEST,
//         success: false,
//         message: "City ID is required !",
//       });
//     }
//     const response = await fetch(
//       "https://api-hermes.pathao.com/aladdin/api/v1/issue-token",
//       {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           client_id: "8mepZDpbMy", // Replace with actual client_id
//           client_secret: "GaE4FmJo3SEHSN04r2owFOdID4H9u6SPO9kQJYKQ", // Replace with actual client_secret
//           grant_type: "password",
//           username: "mumufariha21@gmail.com", // Replace with your email
//           password: "Aa95580", // Replace with your password
//         }),
//       }
//     );

//     const result = await response.json();
//     // city data
//     const zoneData = await fetch(
//       `https://api-hermes.pathao.com/aladdin/api/v1/cities/${city_id}/zone-list`,
//       {
//         method: "get",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${result?.access_token}`, // Replace access_token with actual token
//         },
//       }
//     );

//     // Parse zoneData
//     const zoneResult = await zoneData.json();
//     return sendResponse(res, {
//       statusCode: httpStatus.OK,
//       success: true,
//       message: "Setting Get successfully !",
//       data: zoneResult?.data?.data,
//     });
//   } catch (error: any) {
//     next(error);
//   }
// };
