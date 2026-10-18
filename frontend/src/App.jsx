
import { useEffect, useMemo, useState } from "react";
import "./App.css";
import Login from "./Login";
import { apiRequest } from "./api";

const STATUSES = [
  { value: "TODO", label: "To Do" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "DONE", label: "Done" },
];

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

function App() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [isLoggedIn, setIsLoggedIn] = useState(
    Boolean(localStorage.getItem("access_token"))
  );

  const [projects, setProjects] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [issues, setIssues] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [issueError, setIssueError] = useState("");
  const [updatingIssueId, setUpdatingIssueId] = useState(null);

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState("ALL");

  const [membersByProject, setMembersByProject] = useState({});
  const [availableMembers, setAvailableMembers] = useState([]);
  const [memberUserId, setMemberUserId] = useState("");
  const [memberError, setMemberError] = useState("");
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [modal, setModal] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [editingIssue, setEditingIssue] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [projectForm, setProjectForm] = useState({
    name: "",
    key: "",
    description: "",
  });

  const [issueForm, setIssueForm] = useState({
    title: "",
    description: "",
    project: "",
    priority: "MEDIUM",
    status: "TODO",
    assignee: "",
  });

  const menuItems = [
    { name: "Overview", icon: "◫" },
    { name: "My Projects", icon: "▦" },
    { name: "My Issues", icon: "☷" },
    { name: "Board", icon: "▤" },
  ];

  function handleLogin() {
    setIsLoggedIn(true);
  }

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");

    setProjects([]);
    setIssues([]);
    setMembersByProject({});
    setIsLoggedIn(false);
    setActiveTab("Overview");
  }

  async function loadProjects() {
    setLoadingProjects(true);
    setProjectError("");

    try {
      const data = await apiRequest("/projects/");
      setProjects(Array.isArray(data) ? data : data.results ?? []);
    } catch (error) {
      setProjectError(error.message || "Failed to load projects.");
    } finally {
      setLoadingProjects(false);
    }
  }

  async function loadIssues() {
    setLoadingIssues(true);
    setIssueError("");

    try {
      const data = await apiRequest("/projects/issues/");
      setIssues(Array.isArray(data) ? data : data.results ?? []);
    } catch (error) {
      setIssueError(error.message || "Failed to load issues.");
    } finally {
      setLoadingIssues(false);
    }
  }

  async function updateIssueStatus(issueId, newStatus) {
    setUpdatingIssueId(issueId);
    setIssueError("");

    try {
      const updated = await apiRequest(
        `/projects/issues/${issueId}/`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus }),
        }
      );

      setIssues((current) =>
        current.map((issue) =>
          issue.id === issueId ? updated : issue
        )
      );
    } catch (error) {
      setIssueError(error.message || "Failed to update issue status.");
    } finally {
      setUpdatingIssueId(null);
    }
  }

  async function loadMembers(projectId) {
    if (!projectId) return;

    setLoadingMembers(true);
    setMemberError("");

    try {
      const data = await apiRequest(
        `/projects/${projectId}/members/`
      );

      setMembersByProject((current) => ({
        ...current,
        [projectId]: Array.isArray(data)
          ? data
          : data.results ?? [],
      }));
    } catch (error) {
      setMemberError(
        error.message || "Could not load project members."
      );
    } finally {
      setLoadingMembers(false);
    }
  }

  async function openMemberManager(project) {
    setEditingProject(project);
    setMemberError("");
    setFormError("");
    setMemberUserId("");
    setModal("members");
    await Promise.all([
      loadMembers(project.id),
      apiRequest(`/projects/${project.id}/available-members/`)
        .then((data) => setAvailableMembers(Array.isArray(data) ? data : data.results ?? []))
        .catch((error) => setMemberError(error.message || "Could not load available users.")),
    ]);
  }

  async function addProjectMember(event) {
    event.preventDefault();
    if (!memberUserId || !editingProject) return;
    setMemberError("");
    try {
      await apiRequest(`/projects/${editingProject.id}/members/`, {
        method: "POST",
        body: JSON.stringify({ user_id: Number(memberUserId) }),
      });
      await loadMembers(editingProject.id);
      const data = await apiRequest(`/projects/${editingProject.id}/available-members/`);
      setAvailableMembers(Array.isArray(data) ? data : data.results ?? []);
      setMemberUserId("");
    } catch (error) {
      setMemberError(error.message || "Could not add project member.");
    }
  }

  async function removeProjectMember(member) {
    if (!editingProject) return;
    setMemberError("");
    try {
      await apiRequest(`/projects/${editingProject.id}/members/${member.user}/`, { method: "DELETE" });
      setMembersByProject((current) => ({
        ...current,
        [editingProject.id]: (current[editingProject.id] || []).filter((item) => item.user !== member.user),
      }));
      setIssues((current) => current.map((issue) =>
        Number(issue.project) === Number(editingProject.id) && Number(issue.assignee) === Number(member.user)
          ? { ...issue, assignee: null, assignee_username: null, assignee_display_name: null }
          : issue
      ));
    } catch (error) {
      setMemberError(error.message || "Could not remove project member.");
    }
  }

  useEffect(() => {
    if (!isLoggedIn) return;

    apiRequest("/auth/me/").then(setCurrentUser).catch(() => setCurrentUser(null));
    loadProjects();
    loadIssues();
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;

    projects.forEach((project) => {
      if (
        !Object.prototype.hasOwnProperty.call(
          membersByProject,
          project.id
        )
      ) {
        loadMembers(project.id);
      }
    });
  }, [isLoggedIn, projects, membersByProject]);

  function getProject(projectId) {
    return projects.find(
      (project) => Number(project.id) === Number(projectId)
    );
  }

  function getProjectKey(projectId) {
    return getProject(projectId)?.key || `Project #${projectId}`;
  }

  function getMemberDisplayName(member) {
    return (
      member?.display_name ||
      member?.username ||
      `User #${member?.user ?? ""}`
    );
  }

  function assigneeName(issue) {
    if (issue.assignee == null) return "Unassigned";

    const member = (
      membersByProject[issue.project] || []
    ).find(
      (person) =>
        Number(person.user) === Number(issue.assignee)
    );

    return member
      ? getMemberDisplayName(member)
      : `User #${issue.assignee}`;
  }

  function openProjectModal(project = null) {
    setFormError("");
    setEditingProject(project);

    setProjectForm(
      project
        ? {
            name: project.name || "",
            key: project.key || "",
            description: project.description || "",
          }
        : {
            name: "",
            key: "",
            description: "",
          }
    );

    setModal("project");
  }

  function openIssueModal(issue = null) {
    setFormError("");
    setMemberError("");
    setEditingIssue(issue);

    const projectId = String(
      issue?.project ?? projects[0]?.id ?? ""
    );

    setIssueForm(
      issue
        ? {
            title: issue.title || "",
            description: issue.description || "",
            project: projectId,
            priority: issue.priority || "MEDIUM",
            status: issue.status || "TODO",
            assignee:
              issue.assignee == null
                ? ""
                : String(issue.assignee),
          }
        : {
            title: "",
            description: "",
            project: projectId,
            priority: "MEDIUM",
            status: "TODO",
            assignee: "",
          }
    );

    setModal("issue");

    if (projectId) {
      loadMembers(projectId);
    }
  }

  async function saveProject(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    const payload = {
      name: projectForm.name.trim(),
      key: projectForm.key.trim().toUpperCase(),
      description: projectForm.description.trim(),
    };

    try {
      if (editingProject) {
        const updated = await apiRequest(
          `/projects/${editingProject.id}/`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          }
        );

        setProjects((current) =>
          current.map((project) =>
            project.id === editingProject.id
              ? updated
              : project
          )
        );
      } else {
        const created = await apiRequest("/projects/", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        setProjects((current) => [created, ...current]);
      }

      setModal(null);
      setEditingProject(null);
      setActiveTab("My Projects");
    } catch (error) {
      setFormError(
        error.message ||
          "Could not save project. Check the required fields and your permissions."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject(project) {
    const linkedIssues = issues.filter(
      (issue) => Number(issue.project) === Number(project.id)
    );

    const message = linkedIssues.length
      ? `Delete "${project.name}"? It has ${linkedIssues.length} issue(s). The server may prevent deleting projects with related issues.`
      : `Delete project "${project.name}"? This cannot be undone.`;

    if (!window.confirm(message)) return;

    setProjectError("");

    try {
      await apiRequest(`/projects/${project.id}/`, {
        method: "DELETE",
      });

      setProjects((current) =>
        current.filter((item) => item.id !== project.id)
      );

      setIssues((current) =>
        current.filter(
          (issue) =>
            Number(issue.project) !== Number(project.id)
        )
      );

      setMembersByProject((current) => {
        const next = { ...current };
        delete next[project.id];
        return next;
      });
    } catch (error) {
      setProjectError(
        error.message ||
          "Could not delete project. Check your permissions and related issues."
      );
    }
  }

  async function saveIssue(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    const payload = {
      title: issueForm.title.trim(),
      description: issueForm.description.trim(),
      project: Number(issueForm.project),
      priority: issueForm.priority,
      status: issueForm.status,
      assignee:
        issueForm.assignee === ""
          ? null
          : Number(issueForm.assignee),
    };

    try {
      if (editingIssue) {
        const updated = await apiRequest(
          `/projects/issues/${editingIssue.id}/`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          }
        );

        setIssues((current) =>
          current.map((issue) =>
            issue.id === editingIssue.id ? updated : issue
          )
        );
      } else {
        const created = await apiRequest(
          "/projects/issues/",
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );

        setIssues((current) => [created, ...current]);
      }

      setModal(null);
      setEditingIssue(null);
      setActiveTab("My Issues");
    } catch (error) {
      setFormError(
        error.message ||
          "Could not save issue. Check the selected project and your permissions."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteIssue(issue) {
    if (
      !window.confirm(
        `Delete issue "${issue.title}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setIssueError("");

    try {
      await apiRequest(`/projects/issues/${issue.id}/`, {
        method: "DELETE",
      });

      setIssues((current) =>
        current.filter((item) => item.id !== issue.id)
      );
    } catch (error) {
      setIssueError(
        error.message || "Could not delete issue. Check your permissions."
      );
    }
  }

  const openIssues = issues.filter(
    (issue) => issue.status === "TODO"
  ).length;

  const inProgressIssues = issues.filter(
    (issue) => issue.status === "IN_PROGRESS"
  ).length;

  const completedIssues = issues.filter(
    (issue) => issue.status === "DONE"
  ).length;

  const allMembers = useMemo(() => {
    const membersByUserId = new Map();

    Object.values(membersByProject)
      .flat()
      .forEach((member) => {
        if (member.user != null) {
          membersByUserId.set(Number(member.user), member);
        }
      });

    return Array.from(membersByUserId.values());
  }, [membersByProject]);

  const filteredIssues = useMemo(
    () =>
      issues.filter((issue) => {
        const matchesStatus =
          statusFilter === "ALL" ||
          issue.status === statusFilter;

        const matchesPriority =
          priorityFilter === "ALL" ||
          issue.priority === priorityFilter;

        const matchesProject =
          projectFilter === "ALL" ||
          String(issue.project) === projectFilter;

        const matchesAssignee =
          assigneeFilter === "ALL" ||
          (assigneeFilter === "UNASSIGNED"
            ? issue.assignee == null
            : String(issue.assignee) === assigneeFilter);

        return (
          matchesStatus &&
          matchesPriority &&
          matchesProject &&
          matchesAssignee
        );
      }),
    [
      issues,
      statusFilter,
      priorityFilter,
      projectFilter,
      assigneeFilter,
    ]
  );

  function renderIssueCard(issue, compact = false) {
    return (
      <article
        className={`issue-list-card ${
          compact ? "issue-card-compact" : ""
        }`}
        key={issue.id}
      >
        <div className="activity-icon">✓</div>

        <div className="issue-list-info">
          <strong>{issue.title}</strong>

          <p>
            {getProjectKey(issue.project)} · {issue.priority} priority
            {" · "}Assigned: {assigneeName(issue)}
          </p>

          {issue.description && <p>{issue.description}</p>}
        </div>

        <span
          className={`priority-badge priority-${String(
            issue.priority
          ).toLowerCase()}`}
        >
          {issue.priority}
        </span>

        <select
          className="issue-status-select"
          value={issue.status}
          disabled={updatingIssueId === issue.id}
          onChange={(event) =>
            updateIssueStatus(issue.id, event.target.value)
          }
          aria-label={`Change status for ${issue.title}`}
        >
          {STATUSES.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>

        {updatingIssueId === issue.id && (
          <span className="saving-label">Saving...</span>
        )}

        <div className="item-actions">
          <button
            type="button"
            className="small-action"
            onClick={() => openIssueModal(issue)}
          >
            Edit
          </button>

          <button
            type="button"
            className="small-action danger-action"
            onClick={() => deleteIssue(issue)}
          >
            Delete
          </button>
        </div>
      </article>
    );
  }

  function renderProjectCard(project) {
    const currentMembership = (membersByProject[project.id] || []).find(
      (member) => Number(member.user) === Number(currentUser?.id)
    );
    const canManageMembers = project.owner === currentUser?.username || currentMembership?.role === "ADMIN";
    return (
      <article className="project-card" key={project.id}>
        <div className="project-symbol">
          {String(project.key || project.name || "PR")
            .slice(0, 2)
            .toUpperCase()}
        </div>

        <div className="project-info">
          <strong>{project.name}</strong>
          <p>{project.description || "No description provided."}</p>
        </div>

        <span className="project-key">{project.key}</span>
        <span className="project-status">Active</span>

        <div className="item-actions">
          {canManageMembers && (
            <button
              type="button"
              className="small-action"
              onClick={() => openMemberManager(project)}
            >
              Members ({(membersByProject[project.id] || []).length})
            </button>
          )}
          <button
            type="button"
            className="small-action"
            onClick={() => openProjectModal(project)}
          >
            Edit
          </button>

          <button
            type="button"
            className="small-action danger-action"
            onClick={() => deleteProject(project)}
          >
            Delete
          </button>
        </div>
      </article>
    );
  }

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">I</div>
          <span>IssueFlow</span>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <nav>
          {menuItems.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${
                activeTab === item.name ? "active" : ""
              }`}
              onClick={() => setActiveTab(item.name)}
            >
              <span>{item.icon}</span>
              {item.name}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="avatar">EC</div>

          <div className="user-info">
            <strong>Eren Çelik</strong>
            <small>Developer</small>

            <button
              className="logout-button"
              onClick={handleLogout}
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <span>Workspace / {activeTab}</span>

          <div className="topbar-right">
            <span className="status-dot" />
            <span>All systems operational</span>
          </div>
        </header>

        <section className="page-content">
          <div className="welcome">
            <div>
              <p className="eyebrow">YOUR WORKSPACE</p>
              <h1>{activeTab}</h1>

              <p className="subtitle">
                {activeTab === "My Issues"
                  ? "Track, filter, and manage your issues."
                  : activeTab === "My Projects"
                  ? "View and create projects in your workspace."
                  : activeTab === "Board"
                  ? "Move issues through your workflow."
                  : "Manage your projects and keep your work moving."}
              </p>
            </div>

            <div className="welcome-actions">
              <button
                className="secondary-action"
                onClick={() => openProjectModal()}
              >
                + New project
              </button>

              <button
                className="primary-action"
                onClick={() => openIssueModal()}
                disabled={projects.length === 0}
              >
                + New issue
              </button>
            </div>
          </div>

          {(projectError || issueError) && (
            <div className="app-error">
              {projectError && <p>{projectError}</p>}
              {issueError && <p>{issueError}</p>}

              <button
                className="text-button"
                onClick={() => {
                  loadProjects();
                  loadIssues();
                }}
              >
                Try again
              </button>
            </div>
          )}

          {activeTab === "Overview" && (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <span>Total projects</span>
                  <strong>
                    {loadingProjects
                      ? "..."
                      : String(projects.length).padStart(2, "0")}
                  </strong>
                  <small>Your workspace projects</small>
                </div>

                <div className="stat-card">
                  <span>Open issues</span>
                  <strong>
                    {loadingIssues
                      ? "..."
                      : String(openIssues).padStart(2, "0")}
                  </strong>
                  <small>Issues waiting to be resolved</small>
                </div>

                <div className="stat-card">
                  <span>In progress</span>
                  <strong>
                    {loadingIssues
                      ? "..."
                      : String(inProgressIssues).padStart(2, "0")}
                  </strong>
                  <small>Currently being worked on</small>
                </div>

                <div className="stat-card">
                  <span>Completed</span>
                  <strong>
                    {loadingIssues
                      ? "..."
                      : String(completedIssues).padStart(2, "0")}
                  </strong>
                  <small>Successfully completed issues</small>
                </div>
              </div>

              <section className="projects-section">
                <div className="section-heading">
                  <div>
                    <h2>Recent projects</h2>
                    <p>Your projects at a glance</p>
                  </div>

                  <button
                    className="text-button"
                    onClick={() => setActiveTab("My Projects")}
                  >
                    View all →
                  </button>
                </div>

                {loadingProjects ? (
                  <p className="subtitle">Loading projects...</p>
                ) : projects.length ? (
                  projects.slice(0, 4).map(renderProjectCard)
                ) : (
                  <p className="empty-state">
                    No projects yet. Create your first project.
                  </p>
                )}
              </section>

              <section className="activity-section">
                <div className="section-heading">
                  <div>
                    <h2>Recent activity</h2>
                    <p>What's happening in your workspace</p>
                  </div>

                  <button
                    className="text-button"
                    onClick={() => setActiveTab("My Issues")}
                  >
                    View all →
                  </button>
                </div>

                {loadingIssues ? (
                  <p className="subtitle">Loading issues...</p>
                ) : issues.length ? (
                  issues
                    .slice(0, 5)
                    .map((issue) => renderIssueCard(issue, true))
                ) : (
                  <p className="empty-state">
                    No issues yet. Create your first issue.
                  </p>
                )}
              </section>
            </>
          )}

          {activeTab === "My Projects" && (
            <section className="projects-section">
              <div className="section-heading">
                <div>
                  <h2>All projects</h2>
                  <p>
                    {projects.length} projects in your workspace
                  </p>
                </div>

                <button
                  className="primary-action"
                  onClick={() => openProjectModal()}
                >
                  + New project
                </button>
              </div>

              {loadingProjects ? (
                <p className="subtitle">Loading projects...</p>
              ) : projects.length ? (
                projects.map(renderProjectCard)
              ) : (
                <p className="empty-state">
                  No projects found. Create your first project.
                </p>
              )}
            </section>
          )}

          {activeTab === "My Issues" && (
            <section className="issues-page">
              <div className="section-heading">
                <div>
                  <h2>All issues</h2>
                  <p>Filter and manage your tasks</p>
                </div>

                <button
                  className="primary-action"
                  onClick={() => openIssueModal()}
                  disabled={!projects.length}
                >
                  + New issue
                </button>
              </div>

              <div className="issue-filters">
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value)
                  }
                  aria-label="Filter by status"
                >
                  <option value="ALL">All statuses</option>
                  {STATUSES.map((status) => (
                    <option
                      key={status.value}
                      value={status.value}
                    >
                      {status.label}
                    </option>
                  ))}
                </select>

                <select
                  value={priorityFilter}
                  onChange={(event) =>
                    setPriorityFilter(event.target.value)
                  }
                  aria-label="Filter by priority"
                >
                  <option value="ALL">All priorities</option>
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority[0] +
                        priority.slice(1).toLowerCase()}{" "}
                      priority
                    </option>
                  ))}
                </select>

                <select
                  value={projectFilter}
                  onChange={(event) =>
                    setProjectFilter(event.target.value)
                  }
                  aria-label="Filter by project"
                >
                  <option value="ALL">All projects</option>
                  {projects.map((project) => (
                    <option
                      key={project.id}
                      value={String(project.id)}
                    >
                      {project.name}
                    </option>
                  ))}
                </select>

                <select
                  value={assigneeFilter}
                  onChange={(event) =>
                    setAssigneeFilter(event.target.value)
                  }
                  aria-label="Filter by assignee"
                >
                  <option value="ALL">All assignees</option>
                  <option value="UNASSIGNED">Unassigned</option>

                  {allMembers.map((member) => (
                    <option
                      key={member.user}
                      value={String(member.user)}
                    >
                      {getMemberDisplayName(member)}
                    </option>
                  ))}
                </select>

                <span className="project-key">
                  {filteredIssues.length} issues
                </span>
              </div>

              {loadingIssues ? (
                <p className="subtitle">Loading issues...</p>
              ) : filteredIssues.length ? (
                filteredIssues.map((issue) => renderIssueCard(issue))
              ) : (
                <p className="empty-state">
                  No issues match these filters.
                </p>
              )}
            </section>
          )}

          {activeTab === "Board" && (
            <section className="board-section">
              <div className="section-heading">
                <div>
                  <h2>Kanban board</h2>
                  <p>
                    Update a task's status using its dropdown.
                  </p>
                </div>

                <button
                  className="primary-action"
                  onClick={() => openIssueModal()}
                  disabled={!projects.length}
                >
                  + New issue
                </button>
              </div>

              <div className="kanban-board">
                {STATUSES.map((status) => {
                  const columnIssues = issues.filter(
                    (issue) => issue.status === status.value
                  );

                  return (
                    <div
                      className="kanban-column"
                      key={status.value}
                    >
                      <div className="kanban-column-heading">
                        <strong>{status.label}</strong>
                        <span>{columnIssues.length}</span>
                      </div>

                      {columnIssues.length ? (
                        columnIssues.map((issue) => (
                          <div
                            className="kanban-card"
                            key={issue.id}
                          >
                            <span
                              className={`priority-badge priority-${String(
                                issue.priority
                              ).toLowerCase()}`}
                            >
                              {issue.priority}
                            </span>

                            <h3>{issue.title}</h3>

                            <p>
                              {getProjectKey(issue.project)} ·{" "}
                              {assigneeName(issue)}
                            </p>

                            {issue.description && (
                              <p>{issue.description}</p>
                            )}

                            <select
                              className="issue-status-select"
                              value={issue.status}
                              disabled={
                                updatingIssueId === issue.id
                              }
                              onChange={(event) =>
                                updateIssueStatus(
                                  issue.id,
                                  event.target.value
                                )
                              }
                              aria-label={`Change status for ${issue.title}`}
                            >
                              {STATUSES.map((item) => (
                                <option
                                  key={item.value}
                                  value={item.value}
                                >
                                  {item.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))
                      ) : (
                        <p className="empty-state">No issues</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </section>
      </main>

      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setModal(null);
            }
          }}
        >
          <section
            className="feature-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">ISSUEFLOW WORKSPACE</p>
                <h2 id="modal-title">
                  {modal === "project"
                    ? editingProject
                      ? "Edit project"
                      : "Create project"
                    : modal === "members"
                    ? `Members · ${editingProject?.name || "Project"}`
                    : editingIssue
                    ? "Edit issue"
                    : "Create issue"}
                </h2>
              </div>

              <button
                className="modal-close"
                onClick={() => setModal(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {formError && (
              <p className="form-error">{formError}</p>
            )}

            {modal === "members" ? (
              <div className="feature-form">
                {memberError && <p className="form-error">{memberError}</p>}
                <form className="member-add-form" onSubmit={addProjectMember}>
                  <label>
                    Add existing user
                    <select value={memberUserId} onChange={(event) => setMemberUserId(event.target.value)}>
                      <option value="">Select a user</option>
                      {availableMembers.map((user) => (
                        <option key={user.id} value={String(user.id)}>{user.display_name} (@{user.username})</option>
                      ))}
                    </select>
                  </label>
                  <button className="primary-action" type="submit" disabled={!memberUserId}>Add member</button>
                </form>
                {loadingMembers ? <p className="subtitle">Loading members...</p> : (
                  <div className="member-list">
                    {(membersByProject[editingProject?.id] || []).map((member) => (
                      <div className="member-row" key={member.user}>
                        <span>{getMemberDisplayName(member)} <small>{member.role}</small></span>
                        {member.username !== editingProject?.owner && (
                          <button type="button" className="small-action danger-action" onClick={() => removeProjectMember(member)}>Remove</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : modal === "project" ? (
              <form
                className="feature-form"
                onSubmit={saveProject}
              >
                <label>
                  Project name
                  <input
                    required
                    maxLength={120}
                    value={projectForm.name}
                    onChange={(event) =>
                      setProjectForm({
                        ...projectForm,
                        name: event.target.value,
                      })
                    }
                    placeholder="e.g. Website redesign"
                  />
                </label>

                <label>
                  Project key
                  <input
                    required
                    maxLength={10}
                    pattern="[A-Za-z0-9_-]+"
                    value={projectForm.key}
                    onChange={(event) =>
                      setProjectForm({
                        ...projectForm,
                        key: event.target.value.toUpperCase(),
                      })
                    }
                    placeholder="e.g. WEB"
                  />
                </label>

                <label>
                  Description
                  <textarea
                    rows="3"
                    value={projectForm.description}
                    onChange={(event) =>
                      setProjectForm({
                        ...projectForm,
                        description: event.target.value,
                      })
                    }
                    placeholder="What is this project about?"
                  />
                </label>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="primary-action"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : editingProject
                      ? "Save changes"
                      : "Create project"}
                  </button>
                </div>
              </form>
            ) : (
              <form
                className="feature-form"
                onSubmit={saveIssue}
              >
                <label>
                  Issue title
                  <input
                    required
                    maxLength={200}
                    value={issueForm.title}
                    onChange={(event) =>
                      setIssueForm({
                        ...issueForm,
                        title: event.target.value,
                      })
                    }
                    placeholder="e.g. Add password reset"
                  />
                </label>

                <label>
                  Project
                  <select
                    required
                    value={issueForm.project}
                    onChange={(event) => {
                      const projectId = event.target.value;

                      setIssueForm({
                        ...issueForm,
                        project: projectId,
                        assignee: "",
                      });

                      setMemberError("");

                      if (projectId) {
                        loadMembers(projectId);
                      }
                    }}
                  >
                    <option value="" disabled>
                      Select a project
                    </option>

                    {projects.map((project) => (
                      <option
                        key={project.id}
                        value={String(project.id)}
                      >
                        {project.name} ({project.key})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Assign to
                  <select
                    value={issueForm.assignee}
                    onChange={(event) =>
                      setIssueForm({
                        ...issueForm,
                        assignee: event.target.value,
                      })
                    }
                  >
                    <option value="">Unassigned</option>

                    {(membersByProject[issueForm.project] || []).map(
                      (member) => (
                        <option
                          key={member.user}
                          value={String(member.user)}
                        >
                          {getMemberDisplayName(member)} (
                          {member.role})
                        </option>
                      )
                    )}
                  </select>

                  {loadingMembers && (
                    <small>Loading project members...</small>
                  )}

                  {memberError && (
                    <small className="form-error">
                      {memberError}
                    </small>
                  )}
                </label>

                <label>
                  Description
                  <textarea
                    rows="3"
                    value={issueForm.description}
                    onChange={(event) =>
                      setIssueForm({
                        ...issueForm,
                        description: event.target.value,
                      })
                    }
                    placeholder="Describe the task..."
                  />
                </label>

                <div className="form-two-columns">
                  <label>
                    Priority
                    <select
                      value={issueForm.priority}
                      onChange={(event) =>
                        setIssueForm({
                          ...issueForm,
                          priority: event.target.value,
                        })
                      }
                    >
                      {PRIORITIES.map((priority) => (
                        <option
                          key={priority}
                          value={priority}
                        >
                          {priority[0] +
                            priority.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Status
                    <select
                      value={issueForm.status}
                      onChange={(event) =>
                        setIssueForm({
                          ...issueForm,
                          status: event.target.value,
                        })
                      }
                    >
                      {STATUSES.map((status) => (
                        <option
                          key={status.value}
                          value={status.value}
                        >
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="primary-action"
                    disabled={saving || !projects.length}
                  >
                    {saving
                      ? "Saving..."
                      : editingIssue
                      ? "Save changes"
                      : "Create issue"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
