/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1. Таблица для хранения самих Бизнес-Процессов (результат работы чата или парсера)
  pgm.createTable('business_processes', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    department_id: { type: 'uuid', references: 'departments', onDelete: 'SET NULL' },
    chat_id: { type: 'uuid', references: 'chats', onDelete: 'SET NULL', unique: true }, // Ссылка на чат, где он создавался
    name: { type: 'varchar(255)', notNull: true },
    owner_name: { type: 'varchar(255)' }, // Хозяин процесса
    description: { type: 'text' },
    status: { type: 'varchar(50)', default: 'draft' }, // Статусы: 'draft', 'in_progress', 'approved'
    is_ai_generated: { type: 'boolean', default: false }, // Пометка, что создано парсером
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
  }, { ifNotExists: true });

  // 2. Таблица связей между процессами (для визуализации карты a-ля MindMup)
  pgm.createTable('process_relations', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    source_process_id: { type: 'uuid', references: 'business_processes', onDelete: 'CASCADE' },
    target_process_id: { type: 'uuid', references: 'business_processes', onDelete: 'CASCADE' },
    relation_type: { type: 'varchar(100)' }, // Например: "передает данные", "запускает"
  }, { ifNotExists: true });

  // 3. Таблица для сохранения отчетов ИИ об ошибках и нестыковках
  pgm.createTable('ai_audit_reports', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    prompt_used: { type: 'text' }, // Какой промпт ввел админ
    report_text: { type: 'text' }, // Полный ответ ИИ с анализом
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
  }, { ifNotExists: true });

  // В существующих chat_statuses логика расширится кодом бэкенда.
};

exports.down = (pgm) => {
  pgm.dropTable('ai_audit_reports', { ifExists: true });
  pgm.dropTable('process_relations', { ifExists: true });
  pgm.dropTable('business_processes', { ifExists: true });
};
