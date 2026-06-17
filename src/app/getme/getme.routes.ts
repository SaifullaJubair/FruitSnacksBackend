import express from "express";
import {
  findUserProfileDashboardDataServices,
  getMeUser,
  updateMyProfile,
} from "./getme.controllers";
import { verifyUserToken } from "../../middlewares/verify.user.token";
const router = express.Router();

// Get current user (getMeUser reads + validates the token itself) and
// self-update the profile (verifyUserToken → updateMyProfile, own record only,
// strict field allowlist). Previously PATCH reused the admin updateUser by
// body._id with no auth — an IDOR. See updateMyProfile for details.
router.route("/").get(getMeUser).patch(verifyUserToken, updateMyProfile);

// profile dashboard stats — own data only (req.user.id, was an unauthed query)
router
  .route("/dashboard_data")
  .get(verifyUserToken, findUserProfileDashboardDataServices);

export const UserGetMeRoutes = router;
