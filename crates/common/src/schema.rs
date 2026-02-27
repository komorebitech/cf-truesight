// @generated automatically by Diesel CLI.

diesel::table! {
    api_keys (id) {
        id -> Uuid,
        project_id -> Uuid,
        #[max_length = 8]
        prefix -> Varchar,
        #[max_length = 128]
        key_hash -> Varchar,
        #[max_length = 255]
        label -> Varchar,
        #[max_length = 4]
        environment -> Varchar,
        active -> Bool,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    projects (id) {
        id -> Uuid,
        #[max_length = 255]
        name -> Varchar,
        active -> Bool,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::joinable!(api_keys -> projects (project_id));

diesel::allow_tables_to_appear_in_same_query!(api_keys, projects,);
