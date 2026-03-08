use crate::cli::OutputFormat;
use serde_json::Value;
use tabled::{Table, builder::Builder, settings::Style};

pub fn render(format: OutputFormat, value: &Value) {
    match format {
        OutputFormat::Json => {
            println!("{}", serde_json::to_string_pretty(value).unwrap());
        }
        OutputFormat::Table => {
            render_table(value);
        }
    }
}

fn render_table(value: &Value) {
    // Unwrap paginated responses: { data: [...], meta: {...} }
    if let Value::Object(map) = value
        && let Some(data @ Value::Array(_)) = map.get("data")
        && map.contains_key("meta")
    {
        render_table(data);
        return;
    }
    match value {
        Value::Array(arr) if arr.is_empty() => {
            println!("(no results)");
        }
        Value::Array(arr) => {
            // Collect all keys from all objects to build a consistent header
            let keys = collect_keys(arr);
            if keys.is_empty() {
                // Array of non-objects: print one per line
                for item in arr {
                    println!("{}", format_cell(item));
                }
                return;
            }

            let mut builder = Builder::default();
            builder.push_record(&keys);

            for item in arr {
                let row: Vec<String> = keys
                    .iter()
                    .map(|k| format_cell(item.get(k.as_str()).unwrap_or(&Value::Null)))
                    .collect();
                builder.push_record(row);
            }

            let mut table = Table::from(builder);
            table.with(Style::rounded());
            println!("{table}");
        }
        Value::Object(map) => {
            // Single object: key-value pairs
            let mut builder = Builder::default();
            builder.push_record(["Key", "Value"]);
            for (k, v) in map {
                builder.push_record([k.clone(), format_cell(v)]);
            }
            let mut table = Table::from(builder);
            table.with(Style::rounded());
            println!("{table}");
        }
        Value::Null => {}
        other => {
            println!("{}", format_cell(other));
        }
    }
}

fn collect_keys(arr: &[Value]) -> Vec<String> {
    let mut keys = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for item in arr {
        if let Value::Object(map) = item {
            for k in map.keys() {
                if seen.insert(k.clone()) {
                    keys.push(k.clone());
                }
            }
        }
    }
    keys
}

fn format_cell(v: &Value) -> String {
    match v {
        Value::Null => "".to_string(),
        Value::String(s) => s.clone(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.to_string(),
        _ => serde_json::to_string(v).unwrap_or_default(),
    }
}
