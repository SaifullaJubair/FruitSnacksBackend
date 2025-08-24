import express from "express";
import { findUserProfileDashboardDataServices, getMeUser } from "./getme.controllers";
import { updateUser } from "../user/user.controllers";
const router = express.Router();

//  Get and update User
router.route("/").get(getMeUser).patch(updateUser);

// get profile dashboard data
router.route("/dashboard_data").get(findUserProfileDashboardDataServices)


export const UserGetMeRoutes = router;
