import { User, IUserDocument } from '../models/user.model';

export class UserRepository {
  async findByEmail(email: string): Promise<IUserDocument | null> {
    return User.findOne({ email: email.toLowerCase() }).exec();
  }

  async findById(id: string): Promise<IUserDocument | null> {
    return User.findById(id).exec();
  }

  async create(userData: Partial<IUserDocument>): Promise<IUserDocument> {
    const user = new User(userData);
    return user.save();
  }

  async updatePassword(userId: string, passwordHash: string): Promise<IUserDocument | null> {
    return User.findByIdAndUpdate(userId, { passwordHash }, { new: true }).exec();
  }
}

export const userRepository = new UserRepository();
