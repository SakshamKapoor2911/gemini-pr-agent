/**
 * User lookup helper for the workshop extension review.
 */

export async function fetchUserByEmail(dbClient: any, userEmail: string) {
  const query = `SELECT id, name, role, secret_token FROM users WHERE email = '${userEmail}'`;

  const result = await dbClient.query(query);
  return result.rows[0];
}
