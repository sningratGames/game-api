import { HttpStatus, Inject, Injectable, Logger, NotFoundException, HttpException, BadRequestException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, PipelineStage, Types } from "mongoose";
import { CreateUserDto } from "@app/common/dto/user.dto";
import { User } from "@app/common/model/schema/users.schema";
import { ResponseService } from "@app/common/response/response.service";
import { StringHelper } from "@app/common/helpers/string.helpers";
import { School } from "@app/common/model/schema/schools.schema";
import { UserRole } from "@app/common/enums/role.enum";
import { SearchDTO } from "@app/common/dto/search.dto";
import { dateToString } from "@app/common/pipeline/dateToString.pipeline";
import { ByIdDto } from "@app/common/dto/byId.dto";
import { AuthHelper } from "@app/common/helpers/auth.helper";
import { ImagesService } from "@app/common/helpers/file.helpers";

@Injectable()
export class UserAdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(School.name) private schoolModel: Model<School>,
    @Inject(ResponseService) private readonly responseService: ResponseService,
    @Inject(AuthHelper) private readonly authHelper: AuthHelper,
    @Inject(ImagesService) private imageHelper: ImagesService,
  ) { }

  private readonly logger = new Logger(UserAdminService.name);

  //////////////////////////////////////////// ADMIN //////////////////////////////////////////////

  public async addAdmin(body: CreateUserDto, media: any, req: any,): Promise<any> {
    try {
      const password = body?.password ? this.authHelper.encodePassword(body.password) : this.authHelper.encodePassword("Admin1234");
      let school = await this.schoolModel.findOne({ _id: new Types.ObjectId(body?.schoolId) }).populate("images");
      if (!school) throw new NotFoundException("School Not Found");

      if (media?.length) media[0].isDefault = true;
      let admin = await this.userModel.create({
        name: body.name,
        email: body?.email ?? null,
        phoneNumber: body?.phoneNumber ?? null,
        role: UserRole.ADMIN,
        images: media?.length ? media : null,
        password,
        school: school._id,
      });

      school.admins.push(admin);
      school.adminsCount = school.admins.length;
      await school.save();

      admin.school = school;
      admin = admin.toObject();
      delete admin.password;
      delete admin.school.admins

      return this.responseService.success(true, StringHelper.successResponse("user", "add_admin"), admin,);
    } catch (error) {
      this.logger.error(this.addAdmin.name);
      console.log(error?.message);
      throw new HttpException(error?.response ?? error?.message ?? error, error?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async findAdmin(body: SearchDTO, req: any): Promise<any> {
    try {
      const searchRegex = new RegExp(body.search?.toString(), "i");
      const LIMIT_PAGE: number = body?.limit ?? 10;
      const SKIP: number = (Number(body?.page ?? 1) - 1) * LIMIT_PAGE;

      let searchOption: any = {
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { phoneNumber: searchRegex },
          { "school.name": searchRegex },
        ],
        role: UserRole.ADMIN,
        deletedAt: null,
      };

      if (body?.schoolId) searchOption.school = new Types.ObjectId(body?.schoolId);

      const pipeline: PipelineStage[] = [
        {
          $lookup: {
            from: "school",
            foreignField: "_id",
            localField: "school",
            as: "school",
            pipeline: [
              ...dateToString,
              {
                $lookup: {
                  from: "images",
                  localField: "images",
                  foreignField: "_id",
                  as: "images",
                }
              },
              {
                $project: { admins: 0 },
              },
            ],
          },
        },
        {
          $lookup: {
            from: "images",
            localField: "images",
            foreignField: "_id",
            as: "images",
          }
        },
        ...dateToString,
        {
          $set: {
            school: { $ifNull: [{ $arrayElemAt: ["$school", 0] }, null] },
          },
        },
        {
          $match: searchOption,
        },
        {
          $sort: { createdAt: -1 },
        },
      ];

      const admin = await this.userModel.aggregate(pipeline).skip(SKIP).limit(LIMIT_PAGE);

      const total = await this.userModel.aggregate(pipeline).count("total");

      return this.responseService.paging(StringHelper.successResponse("admin", "list"), admin, {
        totalData: Number(total[0]?.total) ?? 0,
        totalPage: Math.ceil(total[0]?.total ?? 0 / LIMIT_PAGE),
        currentPage: body?.page ?? 1,
        perPage: LIMIT_PAGE,
      },);
    } catch (error) {
      this.logger.error(this.findAdmin.name);
      console.log(error?.message);
      throw new HttpException(error?.response ?? error?.message ?? error, error?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async deleteAdmin(body: ByIdDto, req: any): Promise<any> {
    try {
      let admin = await this.userModel.findOne({
        _id: new Types.ObjectId(body.id),
        role: UserRole.ADMIN,
      });
      if (!admin) throw new NotFoundException("Admin Not Found");

      if (admin.images.length) await this.imageHelper.delete(admin.images);

      admin.images = [];
      admin.deletedAt = new Date();
      await admin.save();

      let school = await this.schoolModel.findOne({ _id: admin.school });
      if (!school) throw new NotFoundException("School Not Found");

      school.admins = school.admins.filter((i) => i.toString() !== admin._id.toString());
      school.adminsCount--;
      await school.save();

      return this.responseService.success(true, StringHelper.successResponse("admin", "delete"));
    } catch (error) {
      this.logger.error(this.deleteAdmin.name);
      console.log(error?.message);
      throw new HttpException(error?.response ?? error?.message ?? error, error?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async detailAdmin(body: ByIdDto, req: any): Promise<any> {
    try {
      let admin = await this.userModel.findOne({ _id: new Types.ObjectId(body.id), role: UserRole.ADMIN })
        .populate('images')
        .populate({
          path: 'school',
          select: "-admins",
          populate: "images"
        });
      if (!admin) throw new NotFoundException("Admin Not Found");

      return this.responseService.success(true, StringHelper.successResponse("admin", "detail"), admin);
    } catch (error) {
      this.logger.error(this.detailAdmin.name);
      console.log(error?.message);
      throw new HttpException(error?.response ?? error?.message ?? error, error?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  //////////////////////////////////////////// STUDENT /////////////////////////////////////////////

  public async addStudent(body: CreateUserDto, media: any, req: any,): Promise<any> {
    try {
      let school = await this.schoolModel.findOne({
        _id: new Types.ObjectId(body?.schoolId),
      });
      if (!school) throw new NotFoundException("School Not Found");

      const check = await this.userModel.findOne({
        role: UserRole.USER,
        name: body.name,
        school: school._id,
      });
      if (check) throw new BadRequestException("Student Already Exist");

      let student = await this.userModel.create({
        name: body.name,
        email: body?.email ?? null,
        phoneNumber: body?.phoneNumber ?? null,
        role: UserRole.USER,
        images: media?.length ? media : null,
        password: null,
        school: school._id,
      });

      school.studentsCount++;
      school.save();

      return this.responseService.success(true, StringHelper.successResponse("user", "add_admin"), student);
    } catch (error) {
      this.logger.error(this.addStudent.name);
      console.log(error?.message);
      throw new HttpException(error?.response ?? error?.message ?? error, error?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async listStudents(body: SearchDTO, req: any): Promise<any> {
    try {
      const searchRegex = new RegExp(body.search?.toString(), "i");
      const LIMIT_PAGE: number = body?.limit ?? 10;
      const SKIP: number = (Number(body?.page ?? 1) - 1) * LIMIT_PAGE;

      let searchOption: any = {
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { phoneNumber: searchRegex },
          { "school.name": searchRegex },
        ],
        role: UserRole.USER,
        deletedAt: null,
      };

      const pipeline: PipelineStage[] = [
        {
          $lookup: {
            from: "school",
            foreignField: "_id",
            localField: "school",
            as: "school",
            pipeline: [
              ...dateToString,
              {
                $project: { admins: 0 },
              },
            ],
          },
        },
        {
          $lookup: {
            from: "images",
            localField: "images",
            foreignField: "_id",
            as: "images",
          },
        },
        ...dateToString,
        {
          $set: {
            school: { $ifNull: [{ $arrayElemAt: ["$school", 0] }, null] },
          },
        },
        {
          $match: searchOption,
        },
        {
          $sort: { createdAt: -1 },
        },
      ];

      const students = await this.userModel.aggregate(pipeline).skip(SKIP).limit(LIMIT_PAGE);

      const total = await this.userModel.aggregate(pipeline).count("total");

      return this.responseService.paging(
        StringHelper.successResponse("student", "list"),
        students,
        {
          totalData: Number(total[0]?.total) ?? 0,
          perPage: LIMIT_PAGE,
          currentPage: body?.page ?? 1,
          totalPage: Math.ceil(total[0]?.total ?? 0 / LIMIT_PAGE),
        },
      );
    } catch (error) {
      this.logger.error(this.addStudent.name);
      console.log(error?.message);
      throw new HttpException(error?.response ?? error?.message ?? error, error?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async deleteStudent(body: ByIdDto, req: any): Promise<any> {
    const users: User = <User>req.user;
    try {
      let student = await this.userModel.findOne({
        _id: new Types.ObjectId(body.id),
        role: UserRole.USER,
      });
      if (!student) throw new NotFoundException("Student Not Found");

      if (student.images.length) await this.imageHelper.delete(student.images);

      student.images = [];
      student.deletedAt = new Date();
      await student.save();

      let school = await this.schoolModel.findOne({ _id: student.school });
      if (!school) throw new NotFoundException("School Not Found");

      school.studentsCount--;
      await school.save();

      return this.responseService.success(true, StringHelper.successResponse("student", "delete"));
    } catch (error) {
      this.logger.error(this.deleteStudent.name);
      console.log(error?.message);
      throw new HttpException(error?.response ?? error?.message ?? error, error?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async getProfile(req: any): Promise<any> {
    try {
      let user = await this.userModel.findOne({
        _id: new Types.ObjectId(req.user._id),
      })
        .populate("images")

      if (!user) throw new NotFoundException("User Not Found")

      return this.responseService.success(true, StringHelper.successResponse("user", "get_profile"), user)
    } catch (error) {
      this.logger.error(this.getProfile.name);
      console.log(error?.message);
      throw new HttpException(error?.response ?? error?.message ?? error, error?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
