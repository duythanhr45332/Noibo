const db = require('../../config/database');

class PostgresFileRepository {
  async create(fileData) {
    const query = `
      INSERT INTO uploaded_files (
        contract_id,
        scope_item_id,
        installment_id,
        original_name,
        stored_name,
        mime_type,
        file_size,
        storage_path,
        category,
        uploaded_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const result = await db.query(query, [
      fileData.contract_id || null,
      fileData.scope_item_id || null,
      fileData.installment_id || null,
      fileData.original_name,
      fileData.stored_name,
      fileData.mime_type,
      fileData.file_size,
      fileData.storage_path,
      fileData.category || 'OTHER',
      fileData.uploaded_by || null,
    ]);

    return result.rows[0];
  }

  async findById(fileId) {
    const query = `
      SELECT f.*, c.deleted_at AS contract_deleted_at, c.phase AS contract_phase
      FROM uploaded_files f
      LEFT JOIN contracts c ON c.contract_id = f.contract_id
      WHERE f.file_id = $1 AND f.deleted_at IS NULL
    `;
    const result = await db.query(query, [fileId]);
    return result.rows[0] || null;
  }

  async softDelete(fileId) {
    const result = await db.query(
      `
        UPDATE uploaded_files
        SET deleted_at = NOW()
        WHERE file_id = $1 AND deleted_at IS NULL
        RETURNING *
      `,
      [fileId]
    );
    return result.rows[0] || null;
  }
}

module.exports = PostgresFileRepository;
