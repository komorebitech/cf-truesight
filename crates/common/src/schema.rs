// @generated automatically by Diesel CLI.

pub mod sql_types {
    #[derive(diesel::query_builder::QueryId, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "team_role"))]
    pub struct TeamRole;
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::TeamRole;

    allowed_domains (id) {
        id -> Uuid,
        team_id -> Uuid,
        #[max_length = 255]
        domain -> Varchar,
        default_role -> TeamRole,
        created_at -> Timestamptz,
    }
}

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
    board_widgets (id) {
        id -> Uuid,
        board_id -> Uuid,
        #[max_length = 50]
        widget_type -> Varchar,
        #[max_length = 255]
        title -> Varchar,
        config -> Jsonb,
        layout -> Jsonb,
        position -> Int4,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    boards (id) {
        id -> Uuid,
        project_id -> Uuid,
        #[max_length = 255]
        name -> Varchar,
        description -> Nullable<Text>,
        is_default -> Bool,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    segments (id) {
        id -> Uuid,
        project_id -> Uuid,
        #[max_length = 255]
        name -> Varchar,
        description -> Nullable<Text>,
        definition -> Jsonb,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
        #[max_length = 50]
        segment_type -> Varchar,
    }
}

diesel::table! {
    funnels (id) {
        id -> Uuid,
        project_id -> Uuid,
        #[max_length = 255]
        name -> Varchar,
        steps -> Jsonb,
        window_seconds -> Int4,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::TeamRole;

    invitations (id) {
        id -> Uuid,
        team_id -> Uuid,
        #[max_length = 255]
        email -> Varchar,
        role -> TeamRole,
        invited_by -> Uuid,
        #[max_length = 128]
        token -> Varchar,
        accepted -> Bool,
        expires_at -> Timestamptz,
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

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::TeamRole;

    team_members (id) {
        id -> Uuid,
        team_id -> Uuid,
        user_id -> Uuid,
        role -> TeamRole,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    team_projects (id) {
        id -> Uuid,
        team_id -> Uuid,
        project_id -> Uuid,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    teams (id) {
        id -> Uuid,
        #[max_length = 255]
        name -> Varchar,
        active -> Bool,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    users (id) {
        id -> Uuid,
        #[max_length = 255]
        email -> Varchar,
        #[max_length = 255]
        name -> Varchar,
        #[max_length = 512]
        picture_url -> Nullable<Varchar>,
        #[max_length = 255]
        google_sub -> Varchar,
        active -> Bool,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
        onboarding_completed_at -> Nullable<Timestamptz>,
    }
}

diesel::joinable!(allowed_domains -> teams (team_id));
diesel::joinable!(api_keys -> projects (project_id));
diesel::joinable!(board_widgets -> boards (board_id));
diesel::joinable!(boards -> projects (project_id));
diesel::joinable!(segments -> projects (project_id));
diesel::joinable!(funnels -> projects (project_id));
diesel::joinable!(invitations -> teams (team_id));
diesel::joinable!(invitations -> users (invited_by));
diesel::joinable!(team_members -> teams (team_id));
diesel::joinable!(team_members -> users (user_id));
diesel::joinable!(team_projects -> projects (project_id));
diesel::joinable!(team_projects -> teams (team_id));

diesel::allow_tables_to_appear_in_same_query!(
    allowed_domains,
    api_keys,
    board_widgets,
    boards,
    segments,
    funnels,
    invitations,
    projects,
    team_members,
    team_projects,
    teams,
    users,
);
