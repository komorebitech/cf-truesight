use clap::{Parser, Subcommand, ValueEnum};

/// TrueSight CLI - analytics event management from the command line.
///
/// Interact with the TrueSight admin API to manage projects, teams,
/// and query analytics data. Designed for AI agents and power users.
#[derive(Parser)]
#[command(name = "truesight", version, about, long_about = None)]
pub struct Cli {
    /// Admin API base URL (e.g. https://api.truesight.example.com)
    #[arg(long, env = "TRUESIGHT_API_URL", global = true)]
    pub api_url: Option<String>,

    /// Bearer token (overrides stored JWT from `auth login`)
    #[arg(long, env = "TRUESIGHT_TOKEN", global = true, hide_env_values = true)]
    pub token: Option<String>,

    /// Default project ID
    #[arg(short, long, env = "TRUESIGHT_PROJECT", global = true)]
    pub project: Option<String>,

    /// Output format
    #[arg(long, env = "TRUESIGHT_FORMAT", global = true, default_value = "json")]
    pub format: OutputFormat,

    /// Enable verbose debug logging
    #[arg(short, long, global = true)]
    pub verbose: bool,

    #[command(subcommand)]
    pub command: Command,
}

#[derive(Clone, Copy, ValueEnum)]
pub enum OutputFormat {
    /// JSON output (default). Ideal for AI agents and piping.
    Json,
    /// Human-readable table output.
    Table,
}

#[derive(Subcommand)]
pub enum Command {
    /// Update the CLI to the latest version
    Update,
    /// Authenticate with TrueSight via Google OAuth
    Auth {
        #[command(subcommand)]
        command: AuthCommand,
    },
    /// Manage CLI configuration (api_url, default_project)
    Config {
        #[command(subcommand)]
        command: ConfigCommand,
    },
    /// Manage projects
    Projects {
        #[command(subcommand)]
        command: ProjectsCommand,
    },
    /// Manage teams, members, projects, invitations, and allowed domains
    Teams {
        #[command(subcommand)]
        command: TeamsCommand,
    },
    /// Query event statistics for a project
    Stats {
        #[command(subcommand)]
        command: StatsCommand,
    },
    /// Browse the event catalog for a project
    #[command(name = "event-catalog")]
    EventCatalog {
        #[command(subcommand)]
        command: EventCatalogCommand,
    },
    /// Query property keys, values, and insights
    Properties {
        #[command(subcommand)]
        command: PropertiesCommand,
    },
    /// Run a trends analysis query
    Trends {
        #[command(subcommand)]
        command: TrendsCommand,
    },
    /// Run a retention analysis query
    Retention {
        #[command(subcommand)]
        command: RetentionCommand,
    },
    /// Run a pivots analysis query
    Pivots {
        #[command(subcommand)]
        command: PivotsCommand,
    },
    /// Run a flows analysis query
    Flows {
        #[command(subcommand)]
        command: FlowsCommand,
    },
    /// Query user profiles and events
    Users {
        #[command(subcommand)]
        command: UsersCommand,
    },
    /// Manage user segments
    Segments {
        #[command(subcommand)]
        command: SegmentsCommand,
    },
    /// Manage user cohorts
    Cohorts {
        #[command(subcommand)]
        command: CohortsCommand,
    },
    /// Manage dashboards (boards) and widgets
    Boards {
        #[command(subcommand)]
        command: BoardsCommand,
    },
    /// Manage funnels and view funnel results
    Funnels {
        #[command(subcommand)]
        command: FunnelsCommand,
    },
}

// -- Auth --

#[derive(Subcommand)]
pub enum AuthCommand {
    /// Sign in via Google OAuth (opens browser)
    Login,
    /// Sign out and remove stored credentials
    Logout,
    /// Show current authentication status
    Status,
    /// Print the raw JWT token to stdout
    Token,
}

// -- Config --

#[derive(Subcommand)]
pub enum ConfigCommand {
    /// Set a configuration value (api_url, default_project)
    Set {
        /// Configuration key
        key: String,
        /// Configuration value
        value: String,
    },
    /// Get a configuration value
    Get {
        /// Configuration key
        key: String,
    },
}

// -- Projects --

#[derive(Subcommand)]
pub enum ProjectsCommand {
    /// List all projects
    List {
        /// Sort by column (name, created_at, updated_at)
        #[arg(long)]
        sort_by: Option<String>,
        /// Sort order: asc or desc
        #[arg(long, default_value = "desc")]
        sort_order: String,
        /// Page number
        #[arg(long)]
        page: Option<u32>,
        /// Results per page
        #[arg(long)]
        per_page: Option<u32>,
    },
    /// Get a project by ID
    Get {
        /// Project ID
        id: String,
    },
    /// Create a new project
    Create {
        /// Project name
        #[arg(long)]
        name: String,
    },
    /// Update a project
    Update {
        /// Project ID
        id: String,
        /// New project name
        #[arg(long)]
        name: Option<String>,
        /// Set project active/inactive
        #[arg(long)]
        active: Option<bool>,
    },
    /// Delete a project
    Delete {
        /// Project ID
        id: String,
    },
}

// -- Teams --

#[derive(Subcommand)]
pub enum TeamsCommand {
    /// List all teams
    List {
        /// Sort by column (name, created_at)
        #[arg(long)]
        sort_by: Option<String>,
        /// Sort order: asc or desc
        #[arg(long, default_value = "desc")]
        sort_order: String,
        /// Page number
        #[arg(long)]
        page: Option<u32>,
        /// Results per page
        #[arg(long)]
        per_page: Option<u32>,
    },
    /// Get a team by ID
    Get {
        /// Team ID
        id: String,
    },
    /// Create a new team
    Create {
        /// Team name
        #[arg(long)]
        name: String,
    },
    /// Update a team
    Update {
        /// Team ID
        id: String,
        /// New team name
        #[arg(long)]
        name: Option<String>,
    },
    /// Delete a team
    Delete {
        /// Team ID
        id: String,
    },
    /// Manage team members
    Members {
        #[command(subcommand)]
        command: TeamMembersCommand,
    },
    /// Manage team-project links
    Projects {
        #[command(subcommand)]
        command: TeamProjectsCommand,
    },
    /// Manage team invitations
    Invitations {
        #[command(subcommand)]
        command: TeamInvitationsCommand,
    },
    /// Manage allowed email domains
    Domains {
        #[command(subcommand)]
        command: TeamDomainsCommand,
    },
}

#[derive(Subcommand)]
pub enum TeamMembersCommand {
    /// List team members
    List {
        /// Team ID
        #[arg(long)]
        team_id: String,
    },
    /// Update a team member's role
    Update {
        /// Team ID
        #[arg(long)]
        team_id: String,
        /// User ID
        #[arg(long)]
        user_id: String,
        /// New role
        #[arg(long)]
        role: String,
    },
    /// Remove a member from the team
    Remove {
        /// Team ID
        #[arg(long)]
        team_id: String,
        /// User ID
        #[arg(long)]
        user_id: String,
    },
}

#[derive(Subcommand)]
pub enum TeamProjectsCommand {
    /// List projects linked to a team
    List {
        /// Team ID
        #[arg(long)]
        team_id: String,
    },
    /// Link a project to a team
    Link {
        /// Team ID
        #[arg(long)]
        team_id: String,
        /// Project ID to link
        #[arg(long)]
        project_id: String,
    },
    /// Unlink a project from a team
    Unlink {
        /// Team ID
        #[arg(long)]
        team_id: String,
        /// Project ID to unlink
        #[arg(long)]
        project_id: String,
    },
}

#[derive(Subcommand)]
pub enum TeamInvitationsCommand {
    /// List pending invitations for a team
    List {
        /// Team ID
        #[arg(long)]
        team_id: String,
    },
    /// Create a new invitation
    Create {
        /// Team ID
        #[arg(long)]
        team_id: String,
        /// Invitee email address
        #[arg(long)]
        email: String,
        /// Role to assign
        #[arg(long, default_value = "viewer")]
        role: String,
    },
    /// Delete/cancel an invitation
    Delete {
        /// Team ID
        #[arg(long)]
        team_id: String,
        /// Invitation ID
        #[arg(long)]
        invitation_id: String,
    },
}

#[derive(Subcommand)]
pub enum TeamDomainsCommand {
    /// List allowed domains for a team
    List {
        /// Team ID
        #[arg(long)]
        team_id: String,
    },
    /// Add an allowed domain
    Add {
        /// Team ID
        #[arg(long)]
        team_id: String,
        /// Domain name (e.g. example.com)
        #[arg(long)]
        domain: String,
    },
    /// Remove an allowed domain
    Remove {
        /// Team ID
        #[arg(long)]
        team_id: String,
        /// Domain ID
        #[arg(long)]
        domain_id: String,
    },
}

// -- Stats --

#[derive(Subcommand)]
pub enum StatsCommand {
    /// Get total event count for a time range
    #[command(name = "event-count")]
    EventCount {
        /// Start date (DD-MM-YYYY or YYYY-MM-DD)
        #[arg(long)]
        from: String,
        /// End date (DD-MM-YYYY or YYYY-MM-DD)
        #[arg(long)]
        to: String,
    },
    /// Get event throughput over time
    Throughput {
        /// Start date (DD-MM-YYYY or YYYY-MM-DD)
        #[arg(long)]
        from: String,
        /// End date (DD-MM-YYYY or YYYY-MM-DD)
        #[arg(long)]
        to: String,
        /// Time granularity (hour, day)
        #[arg(long, default_value = "day")]
        granularity: String,
    },
    /// Get event type distribution
    #[command(name = "event-types")]
    EventTypes {
        #[arg(long)]
        from: String,
        #[arg(long)]
        to: String,
    },
    /// Get event name distribution
    #[command(name = "event-names")]
    EventNames {
        #[arg(long)]
        from: String,
        #[arg(long)]
        to: String,
        #[arg(long)]
        limit: Option<u32>,
    },
    /// List individual events
    Events {
        #[arg(long)]
        from: String,
        #[arg(long)]
        to: String,
        /// Page number (default: 1)
        #[arg(long)]
        page: Option<u32>,
        /// Results per page (default: 50, max: 200)
        #[arg(long)]
        per_page: Option<u32>,
        /// Filter by event type
        #[arg(long)]
        event_type: Option<String>,
        /// Filter by event name
        #[arg(long)]
        event_name: Option<String>,
        /// Sort by column (client_timestamp, server_timestamp, event_name, event_type)
        #[arg(long)]
        sort_by: Option<String>,
        /// Sort order: asc or desc
        #[arg(long, default_value = "desc")]
        sort_order: String,
    },
    /// Get active user counts
    #[command(name = "active-users")]
    ActiveUsers {
        #[arg(long)]
        from: String,
        #[arg(long)]
        to: String,
    },
    /// Get currently live user count
    #[command(name = "live-users")]
    LiveUsers,
    /// Get platform distribution
    #[command(name = "platform-distribution")]
    PlatformDistribution {
        #[arg(long)]
        from: String,
        #[arg(long)]
        to: String,
    },
}

// -- Event Catalog --

#[derive(Subcommand)]
pub enum EventCatalogCommand {
    /// List all tracked event names
    List {
        /// Sort by column (event_name, event_count, first_seen, last_seen)
        #[arg(long)]
        sort_by: Option<String>,
        /// Sort order: asc or desc
        #[arg(long, default_value = "desc")]
        sort_order: String,
        /// Page number
        #[arg(long)]
        page: Option<u32>,
        /// Results per page
        #[arg(long)]
        per_page: Option<u32>,
    },
    /// Get properties for a specific event name
    Properties {
        /// Event name to get properties for
        event_name: String,
    },
}

// -- Properties --

#[derive(Subcommand)]
pub enum PropertiesCommand {
    /// List property keys
    Keys {
        /// Filter by event name
        #[arg(long)]
        event_name: Option<String>,
    },
    /// List values for a property key
    Values {
        /// Property key name
        #[arg(long)]
        key: String,
        /// Filter by event name
        #[arg(long)]
        event_name: Option<String>,
    },
    /// Run property insights analysis (POST with JSON body)
    Insights {
        /// Inline JSON body
        #[arg(long)]
        body: Option<String>,
        /// Path to JSON file
        #[arg(long)]
        body_file: Option<String>,
    },
}

// -- Trends --

#[derive(Subcommand)]
pub enum TrendsCommand {
    /// Run a trends query (POST with JSON body)
    Query {
        /// Inline JSON body
        #[arg(long)]
        body: Option<String>,
        /// Path to JSON file
        #[arg(long)]
        body_file: Option<String>,
    },
}

// -- Retention --

#[derive(Subcommand)]
pub enum RetentionCommand {
    /// Run a retention query (POST with JSON body)
    Query {
        /// Inline JSON body
        #[arg(long)]
        body: Option<String>,
        /// Path to JSON file
        #[arg(long)]
        body_file: Option<String>,
    },
}

// -- Pivots --

#[derive(Subcommand)]
pub enum PivotsCommand {
    /// Run a pivots query (POST with JSON body)
    Query {
        /// Inline JSON body
        #[arg(long)]
        body: Option<String>,
        /// Path to JSON file
        #[arg(long)]
        body_file: Option<String>,
    },
}

// -- Flows --

#[derive(Subcommand)]
pub enum FlowsCommand {
    /// Run a flows query (POST with JSON body)
    Query {
        /// Inline JSON body
        #[arg(long)]
        body: Option<String>,
        /// Path to JSON file
        #[arg(long)]
        body_file: Option<String>,
    },
}

// -- Users --

#[derive(Subcommand)]
pub enum UsersCommand {
    /// List user profiles
    List {
        /// Page number (default: 1)
        #[arg(long)]
        page: Option<u32>,
        /// Results per page (default: 50, max: 200)
        #[arg(long)]
        per_page: Option<u32>,
        /// Search query
        #[arg(long)]
        search: Option<String>,
        /// Sort by column (last_seen, first_seen, event_count)
        #[arg(long)]
        sort_by: Option<String>,
        /// Sort order: asc or desc
        #[arg(long, default_value = "desc")]
        sort_order: String,
    },
    /// Get a user profile by ID
    Get {
        /// User ID (distinct_id)
        id: String,
    },
    /// List events for a specific user
    Events {
        /// User ID (distinct_id)
        id: String,
        /// Page number (default: 1)
        #[arg(long)]
        page: Option<u32>,
        /// Results per page (default: 50, max: 200)
        #[arg(long)]
        per_page: Option<u32>,
    },
}

// -- Segments --

#[derive(Subcommand)]
pub enum SegmentsCommand {
    /// List all segments
    List,
    /// Get a segment by ID
    Get {
        /// Segment ID
        id: String,
    },
    /// Create a segment (POST with JSON body)
    Create {
        /// Inline JSON body
        #[arg(long)]
        body: Option<String>,
        /// Path to JSON file
        #[arg(long)]
        body_file: Option<String>,
    },
    /// Update a segment (PATCH with JSON body)
    Update {
        /// Segment ID
        id: String,
        /// Inline JSON body
        #[arg(long)]
        body: Option<String>,
        /// Path to JSON file
        #[arg(long)]
        body_file: Option<String>,
    },
    /// Delete a segment
    Delete {
        /// Segment ID
        id: String,
    },
    /// Get the size (user count) of a segment
    Size {
        /// Segment ID
        id: String,
    },
    /// List users in a segment
    Users {
        /// Segment ID
        id: String,
        /// Page number (default: 1)
        #[arg(long)]
        page: Option<u32>,
        /// Results per page (default: 50, max: 200)
        #[arg(long)]
        per_page: Option<u32>,
    },
    /// Preview segment results without saving
    Preview {
        /// Inline JSON body
        #[arg(long)]
        body: Option<String>,
        /// Path to JSON file
        #[arg(long)]
        body_file: Option<String>,
    },
}

// -- Cohorts --

#[derive(Subcommand)]
pub enum CohortsCommand {
    /// List all cohorts
    List,
    /// Get a cohort by ID
    Get {
        /// Cohort ID
        id: String,
    },
    /// Create a cohort (POST with JSON body)
    Create {
        /// Inline JSON body
        #[arg(long)]
        body: Option<String>,
        /// Path to JSON file
        #[arg(long)]
        body_file: Option<String>,
    },
    /// Update a cohort (PATCH with JSON body)
    Update {
        /// Cohort ID
        id: String,
        /// Inline JSON body
        #[arg(long)]
        body: Option<String>,
        /// Path to JSON file
        #[arg(long)]
        body_file: Option<String>,
    },
    /// Delete a cohort
    Delete {
        /// Cohort ID
        id: String,
    },
    /// Get the size (user count) of a cohort
    Size {
        /// Cohort ID
        id: String,
    },
    /// List users in a cohort
    Users {
        /// Cohort ID
        id: String,
        /// Page number (default: 1)
        #[arg(long)]
        page: Option<u32>,
        /// Results per page (default: 50, max: 200)
        #[arg(long)]
        per_page: Option<u32>,
    },
}

// -- Boards --

#[derive(Subcommand)]
pub enum BoardsCommand {
    /// List all boards
    List,
    /// Get a board by ID
    Get {
        /// Board ID
        id: String,
    },
    /// Create a board (POST with JSON body)
    Create {
        /// Inline JSON body
        #[arg(long)]
        body: Option<String>,
        /// Path to JSON file
        #[arg(long)]
        body_file: Option<String>,
    },
    /// Update a board (PATCH with JSON body)
    Update {
        /// Board ID
        id: String,
        /// Inline JSON body
        #[arg(long)]
        body: Option<String>,
        /// Path to JSON file
        #[arg(long)]
        body_file: Option<String>,
    },
    /// Delete a board
    Delete {
        /// Board ID
        id: String,
    },
    /// Manage widgets on a board
    Widgets {
        #[command(subcommand)]
        command: BoardWidgetsCommand,
    },
    /// Update widget layouts on a board
    Layouts {
        /// Board ID
        #[arg(long)]
        board_id: String,
        /// Inline JSON body with layout data
        #[arg(long)]
        body: Option<String>,
        /// Path to JSON file
        #[arg(long)]
        body_file: Option<String>,
    },
}

#[derive(Subcommand)]
pub enum BoardWidgetsCommand {
    /// Create a widget on a board (POST with JSON body)
    Create {
        /// Board ID
        #[arg(long)]
        board_id: String,
        /// Inline JSON body
        #[arg(long)]
        body: Option<String>,
        /// Path to JSON file
        #[arg(long)]
        body_file: Option<String>,
    },
    /// Update a widget (PATCH with JSON body)
    Update {
        /// Board ID
        #[arg(long)]
        board_id: String,
        /// Widget ID
        #[arg(long)]
        widget_id: String,
        /// Inline JSON body
        #[arg(long)]
        body: Option<String>,
        /// Path to JSON file
        #[arg(long)]
        body_file: Option<String>,
    },
    /// Delete a widget
    Delete {
        /// Board ID
        #[arg(long)]
        board_id: String,
        /// Widget ID
        #[arg(long)]
        widget_id: String,
    },
}

// -- Funnels --

#[derive(Subcommand)]
pub enum FunnelsCommand {
    /// List all funnels
    List,
    /// Get a funnel by ID
    Get {
        /// Funnel ID
        id: String,
    },
    /// Create a funnel (POST with JSON body)
    Create {
        /// Inline JSON body
        #[arg(long)]
        body: Option<String>,
        /// Path to JSON file
        #[arg(long)]
        body_file: Option<String>,
    },
    /// Update a funnel (PATCH with JSON body)
    Update {
        /// Funnel ID
        id: String,
        /// Inline JSON body
        #[arg(long)]
        body: Option<String>,
        /// Path to JSON file
        #[arg(long)]
        body_file: Option<String>,
    },
    /// Delete a funnel
    Delete {
        /// Funnel ID
        id: String,
    },
    /// Get funnel computation results
    Results {
        /// Funnel ID
        id: String,
        #[arg(long)]
        from: Option<String>,
        #[arg(long)]
        to: Option<String>,
    },
    /// Compare funnel results across segments
    Compare {
        /// Comma-separated funnel IDs
        #[arg(long)]
        ids: String,
        #[arg(long)]
        from: Option<String>,
        #[arg(long)]
        to: Option<String>,
    },
    /// Compare funnel results across time ranges
    #[command(name = "compare-time")]
    CompareTime {
        /// Funnel ID
        id: String,
        #[arg(long)]
        from: String,
        #[arg(long)]
        to: String,
        #[arg(long)]
        compare_from: String,
        #[arg(long)]
        compare_to: String,
    },
}
