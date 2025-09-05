import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq } from 'drizzle-orm';

// Test input with all required fields
const testInput: CreateUserInput = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'securepassword123'
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user with hashed password', async () => {
    const result = await createUser(testInput);

    // Basic field validation
    expect(result.username).toEqual('testuser');
    expect(result.email).toEqual('test@example.com');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Password should be hashed, not stored in plain text
    expect(result.password_hash).toBeDefined();
    expect(result.password_hash).not.toEqual('securepassword123');
    expect(result.password_hash.length).toBeGreaterThan(10);
  });

  it('should save user to database', async () => {
    const result = await createUser(testInput);

    // Query database to verify user was saved
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].username).toEqual('testuser');
    expect(users[0].email).toEqual('test@example.com');
    expect(users[0].password_hash).toBeDefined();
    expect(users[0].created_at).toBeInstanceOf(Date);
    expect(users[0].updated_at).toBeInstanceOf(Date);
  });

  it('should hash password securely', async () => {
    const result = await createUser(testInput);

    // Verify password was hashed using Bun's password utilities
    const isValidHash = await Bun.password.verify('securepassword123', result.password_hash);
    expect(isValidHash).toBe(true);

    // Verify wrong password doesn't match
    const isInvalidHash = await Bun.password.verify('wrongpassword', result.password_hash);
    expect(isInvalidHash).toBe(false);
  });

  it('should create users with different usernames and emails', async () => {
    const user1Input: CreateUserInput = {
      username: 'user1',
      email: 'user1@example.com',
      password: 'password123'
    };

    const user2Input: CreateUserInput = {
      username: 'user2',
      email: 'user2@example.com',
      password: 'differentpassword'
    };

    const result1 = await createUser(user1Input);
    const result2 = await createUser(user2Input);

    expect(result1.id).not.toEqual(result2.id);
    expect(result1.username).toEqual('user1');
    expect(result2.username).toEqual('user2');
    expect(result1.email).toEqual('user1@example.com');
    expect(result2.email).toEqual('user2@example.com');
    expect(result1.password_hash).not.toEqual(result2.password_hash);
  });

  it('should enforce unique username constraint', async () => {
    // Create first user
    await createUser(testInput);

    // Try to create second user with same username
    const duplicateInput: CreateUserInput = {
      username: 'testuser', // Same username
      email: 'different@example.com',
      password: 'anotherpassword'
    };

    await expect(createUser(duplicateInput)).rejects.toThrow(/duplicate key value violates unique constraint/i);
  });

  it('should enforce unique email constraint', async () => {
    // Create first user
    await createUser(testInput);

    // Try to create second user with same email
    const duplicateInput: CreateUserInput = {
      username: 'differentuser',
      email: 'test@example.com', // Same email
      password: 'anotherpassword'
    };

    await expect(createUser(duplicateInput)).rejects.toThrow(/duplicate key value violates unique constraint/i);
  });

  it('should handle long usernames and emails within limits', async () => {
    const longInput: CreateUserInput = {
      username: 'a'.repeat(50), // Max length according to schema
      email: 'test@' + 'a'.repeat(240) + '.com', // Near max length for email
      password: 'validpassword123'
    };

    const result = await createUser(longInput);

    expect(result.username).toEqual('a'.repeat(50));
    expect(result.email).toEqual('test@' + 'a'.repeat(240) + '.com');
    expect(result.password_hash).toBeDefined();
  });
});