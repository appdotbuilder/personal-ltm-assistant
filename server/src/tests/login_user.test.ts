import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginUserInput } from '../schema';
import { loginUser } from '../handlers/login_user';

// Test user data
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'testpassword123'
};

const loginInput: LoginUserInput = {
  email: testUser.email,
  password: testUser.password
};

describe('loginUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should authenticate user with valid credentials', async () => {
    // Create user with hashed password
    const hashedPassword = await Bun.password.hash(testUser.password);
    
    await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        password_hash: hashedPassword
      })
      .execute();

    const result = await loginUser(loginInput);

    // Verify returned user data
    expect(result.email).toEqual(testUser.email);
    expect(result.username).toEqual(testUser.username);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.password_hash).toBeDefined();
  });

  it('should throw error for non-existent email', async () => {
    const invalidEmailInput: LoginUserInput = {
      email: 'nonexistent@example.com',
      password: 'somepassword'
    };

    await expect(loginUser(invalidEmailInput)).rejects.toThrow(/invalid credentials/i);
  });

  it('should throw error for incorrect password', async () => {
    // Create user with correct password
    const hashedPassword = await Bun.password.hash(testUser.password);
    
    await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        password_hash: hashedPassword
      })
      .execute();

    const wrongPasswordInput: LoginUserInput = {
      email: testUser.email,
      password: 'wrongpassword'
    };

    await expect(loginUser(wrongPasswordInput)).rejects.toThrow(/invalid credentials/i);
  });

  it('should handle case-sensitive email matching', async () => {
    // Create user with lowercase email
    const hashedPassword = await Bun.password.hash(testUser.password);
    
    await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email.toLowerCase(),
        password_hash: hashedPassword
      })
      .execute();

    // Try to login with uppercase email
    const uppercaseEmailInput: LoginUserInput = {
      email: testUser.email.toUpperCase(),
      password: testUser.password
    };

    await expect(loginUser(uppercaseEmailInput)).rejects.toThrow(/invalid credentials/i);
  });

  it('should authenticate user with special characters in password', async () => {
    const specialPasswordUser = {
      username: 'specialuser',
      email: 'special@example.com',
      password: 'P@ssw0rd!@#$%^&*()'
    };

    const hashedPassword = await Bun.password.hash(specialPasswordUser.password);
    
    await db.insert(usersTable)
      .values({
        username: specialPasswordUser.username,
        email: specialPasswordUser.email,
        password_hash: hashedPassword
      })
      .execute();

    const specialPasswordInput: LoginUserInput = {
      email: specialPasswordUser.email,
      password: specialPasswordUser.password
    };

    const result = await loginUser(specialPasswordInput);

    expect(result.email).toEqual(specialPasswordUser.email);
    expect(result.username).toEqual(specialPasswordUser.username);
    expect(result.id).toBeDefined();
  });

  it('should throw error for empty password', async () => {
    // Create user first
    const hashedPassword = await Bun.password.hash(testUser.password);
    
    await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        password_hash: hashedPassword
      })
      .execute();

    const emptyPasswordInput: LoginUserInput = {
      email: testUser.email,
      password: ''
    };

    await expect(loginUser(emptyPasswordInput)).rejects.toThrow(/invalid credentials/i);
  });

  it('should return complete user object structure', async () => {
    const hashedPassword = await Bun.password.hash(testUser.password);
    
    const insertResult = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        password_hash: hashedPassword
      })
      .returning()
      .execute();

    const createdUser = insertResult[0];
    const result = await loginUser(loginInput);

    // Verify all required fields are present
    expect(result.id).toEqual(createdUser.id);
    expect(result.username).toEqual(createdUser.username);
    expect(result.email).toEqual(createdUser.email);
    expect(result.password_hash).toEqual(createdUser.password_hash);
    expect(result.created_at).toEqual(createdUser.created_at);
    expect(result.updated_at).toEqual(createdUser.updated_at);
  });
});