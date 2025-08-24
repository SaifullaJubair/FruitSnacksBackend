import { adminSearchableField, IAdminInterface } from "./admin.interface";
import AdminModel from "./admin.model";

// Check a Admin is exists?
export const findAdminInfoServices = async (
  admin_phone: string
): Promise<IAdminInterface | null> => {
  const Admin = await AdminModel.findOne({ admin_phone: admin_phone })
    .populate([
      "role_id",
    ])
    .select("-admin_password -admin_otp");
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
  const findIAdminInterface: IAdminInterface | any = await AdminModel.findOne({
    admin_phone: admin_phone,
  })
    .populate("role_id")
    .select("-__v");
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
    .populate(["role_id", "admin_publisher_id", "admin_updated_by"])
    .sort({ _id: 1 })
    .skip(skip)
    .limit(limit)
    .select("-__v");
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
