import { adminSearchableField, IAdminInterface } from "./admin.interface";
import AdminModel from "./admin.model";

/**
 * The projection every admin READ must use.
 *
 * `admin_password` is a bcrypt hash and `forgot_otp` is a live password-reset
 * token — neither may ever reach a browser. The staff list shipped both to the
 * admin UI (it selected only `-__v`), which handed every logged-in staff member
 * the hash of every other admin's password, including the owner's, to attack
 * offline at their leisure.
 *
 * Note `-admin_otp` appeared in one query but the field is called `forgot_otp`,
 * so it stripped nothing. That is exactly why this is ONE constant instead of a
 * string repeated per query: a typo in a projection fails silently and open.
 */
export const ADMIN_SAFE_PROJECTION =
  "-admin_password -forgot_otp -otp_expires_at -otp_sent_at -otp_attempts -__v";

/**
 * Populating an admin ref needs the projection too.
 *
 * `.select()` applies to the queried document, NOT to populated ones — so a
 * safe projection on the list still shipped hashes through
 * `admin_publisher_id` / `admin_updated_by`, which are admins themselves.
 * Verified: fixing only the top-level select left the refs leaking.
 */
export const ADMIN_SAFE_POPULATE = [
  { path: "role_id" },
  { path: "admin_publisher_id", select: ADMIN_SAFE_PROJECTION },
  { path: "admin_updated_by", select: ADMIN_SAFE_PROJECTION },
];

// Check a Admin is exists?
export const findAdminInfoServices = async (
  admin_phone: string
): Promise<IAdminInterface | null> => {
  const Admin = await AdminModel.findOne({ admin_phone: admin_phone })
    .populate([
      "role_id",
    ])
    .select(ADMIN_SAFE_PROJECTION);
  if (Admin) {
    return Admin;
  } else {
    return null;
  }
};

// Find a IAdminInterface for verify token
export const checkAdminExitsForVerify = async (
  admin_phone: any
): Promise<IAdminInterface | any> => {
  // verify.token.ts only reads admin_status + the populated role, never the
  // password — so this stays on the safe projection too.
  const findIAdminInterface: IAdminInterface | any = await AdminModel.findOne({
    admin_phone: admin_phone,
  })
    .populate("role_id")
    .select(ADMIN_SAFE_PROJECTION);
  return findIAdminInterface;
};

// Create A Admin
export const postAdminServices = async (
  data: IAdminInterface
): Promise<IAdminInterface | {}> => {
  const createAdmin: IAdminInterface | {} = await AdminModel.create(data);
  return createAdmin;
};

// Find all dashboard Admin Role Admin
export const findAllDashboardAdminRoleAdminServices = async (
  limit: number,
  skip: number,
  searchTerm: any
): Promise<IAdminInterface[] | []> => {
  const andCondition = [];
  if (searchTerm) {
    andCondition.push({
      $or: adminSearchableField.map((field) => ({
        [field]: {
          $regex: searchTerm,
          $options: "i",
        },
      })),
    });
  }
  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};
  const findAdmin: IAdminInterface[] | [] = await AdminModel.find(
    whereCondition
  )
    // The refs are admins too, so they carry the projection as well — a plain
    // .select() does not reach populated documents.
    .populate(ADMIN_SAFE_POPULATE)
    .sort({ _id: 1 })
    .skip(skip)
    .limit(limit)
    // Was "-__v": this list shipped every admin's bcrypt hash and reset OTP to
    // the browser.
    .select(ADMIN_SAFE_PROJECTION);
  return findAdmin;
};

// Update a Admin
export const updateAdminServices = async (
  data: IAdminInterface,
  _id: string
): Promise<IAdminInterface | any> => {
  const updateAdminInfo: IAdminInterface | null = await AdminModel.findOne({
    _id: _id,
  });
  if (!updateAdminInfo) {
    throw new Error("Admin Not Found !");
  }
  const Admin = await AdminModel.updateOne({ _id: _id }, data, {
    runValidators: true,
  });
  return Admin;
};

// delete a Admin start

export const deleteAdminServices = async (
  _id: string
): Promise<IAdminInterface | any> => {
  const deleteAdminInfo: IAdminInterface | null = await AdminModel.findOne({
    _id: _id,
  });
  if (!deleteAdminInfo) {
    throw new Error("Admin Not Found !");
  }
  const Admin = await AdminModel.deleteOne(
    { _id: _id },
    {
      runValidators: true,
    }
  );
  return Admin;
};
