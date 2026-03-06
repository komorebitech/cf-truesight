import { useState } from "react";
import { useNavigate } from "react-router";
import { ChevronsUpDown, Check, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjects } from "@/hooks/use-projects";
import { useLastProject } from "@/hooks/use-last-project";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

interface ProjectSwitcherProps {
  currentProjectId?: string;
  collapsed?: boolean;
}

export function ProjectSwitcher({
  currentProjectId,
  collapsed,
}: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { setLastProject } = useLastProject();
  const { data: projectsData } = useProjects();
  const projects = projectsData?.data ?? [];

  const currentProject = projects.find((p) => p.id === currentProjectId);

  const handleSelect = (projectId: string) => {
    setLastProject(projectId);
    navigate(`/projects/${projectId}`);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between gap-2 px-3 py-2 h-auto font-normal text-sidebar-foreground hover:bg-sidebar-active hover:text-sidebar-foreground",
            collapsed && "justify-center px-2",
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <FolderKanban className="h-4 w-4 shrink-0 text-sidebar-foreground" />
            {!collapsed && (
              <span className="truncate text-sm font-medium">
                {currentProject?.name ?? "Select project"}
              </span>
            )}
          </div>
          {!collapsed && (
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search projects..." />
          <CommandList>
            <CommandEmpty>No projects found.</CommandEmpty>
            <CommandGroup>
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={project.name}
                  onSelect={() => handleSelect(project.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      currentProjectId === project.id
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  <span className="truncate">{project.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  navigate("/");
                  setOpen(false);
                }}
              >
                <FolderKanban className="mr-2 h-4 w-4" />
                View all projects
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
