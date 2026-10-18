
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from .models import Issue, Project, ProjectMembership

from .models import Project, ProjectMembership

User = get_user_model()


class ProjectTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="eren_dev",
            email="eren@example.com",
            password="TestPass123!",
        )
        self.client.force_authenticate(user=self.user)
        self.url = "/api/v1/projects/"

    def test_user_can_create_project(self):
        response = self.client.post(
            self.url,
            {
                "name": "Test Project",
                "key": "TEST",
                "description": "A test project.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Project.objects.count(), 1)
        self.assertEqual(Project.objects.first().owner, self.user)

    def test_project_owner_becomes_admin_member(self):
        response = self.client.post(
            self.url,
            {
                "name": "Test Project",
                "key": "TEST",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        membership = ProjectMembership.objects.get(
            project_id=response.data["id"],
            user=self.user,
        )
        self.assertEqual(membership.role, ProjectMembership.Role.ADMIN)

    def test_unauthenticated_user_cannot_create_project(self):
        self.client.force_authenticate(user=None)

        response = self.client.post(
            self.url,
            {
                "name": "Test Project",
                "key": "TEST",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )


    def test_non_owner_cannot_update_project(self):
        other_user = User.objects.create_user(
            username="other_user",
            email="other@example.com",
            password="TestPass123!",
        )

        project = Project.objects.create(
            name="Original Project",
            key="ORIG",
            owner=self.user,
        )

        ProjectMembership.objects.create(
            project=project,
            user=self.user,
            role=ProjectMembership.Role.ADMIN,
        )

        ProjectMembership.objects.create(
            project=project,
            user=other_user,
            role=ProjectMembership.Role.MEMBER,
        )

        self.client.force_authenticate(user=other_user)

        response = self.client.patch(
            f"{self.url}{project.id}/",
            {"name": "Hacked Project"},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        project.refresh_from_db()
        self.assertEqual(project.name, "Original Project")

    def test_non_owner_cannot_delete_project(self):
        other_user = User.objects.create_user(
            username="other_user",
            email="other@example.com",
            password="TestPass123!",
        )

        project = Project.objects.create(
            name="Protected Project",
            key="SAFE",
            owner=self.user,
        )

        ProjectMembership.objects.create(
            project=project,
            user=self.user,
            role=ProjectMembership.Role.ADMIN,
        )

        ProjectMembership.objects.create(
            project=project,
            user=other_user,
            role=ProjectMembership.Role.MEMBER,
        )

        self.client.force_authenticate(user=other_user)

        response = self.client.delete(
            f"{self.url}{project.id}/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.assertTrue(
            Project.objects.filter(id=project.id).exists()
        )


class IssueTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="issue_owner",
            email="issue_owner@example.com",
            password="TestPass123!",
        )
        self.client.force_authenticate(user=self.user)

        self.project = Project.objects.create(
            name="Issue Test Project",
            key="ITEST",
            owner=self.user,
        )

        ProjectMembership.objects.create(
            project=self.project,
            user=self.user,
            role=ProjectMembership.Role.ADMIN,
        )

        self.url = "/api/v1/projects/issues/"

    def test_user_can_create_issue(self):
        response = self.client.post(
            self.url,
            {
                "project": self.project.id,
                "title": "Test issue",
                "priority": "HIGH",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Test issue")
        self.assertEqual(response.data["reporter"], self.user.username)

    def test_user_cannot_access_issue_from_another_project(self):
        other_user = User.objects.create_user(
            username="other_owner",
            email="other_owner@example.com",
            password="TestPass123!",
        )

        other_project = Project.objects.create(
            name="Private Project",
            key="PRIV",
            owner=other_user,
        )

        issue = Issue.objects.create(
            project=other_project,
            title="Private issue",
            reporter=other_user,
        )

        response = self.client.get(
            f"{self.url}{issue.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_issue_can_be_assigned_only_to_project_member_and_filtered(self):
        teammate = User.objects.create_user(
            username="teammate", email="teammate@example.com", password="TestPass123!"
        )
        ProjectMembership.objects.create(project=self.project, user=teammate)
        response = self.client.post(self.url, {
            "project": self.project.id,
            "title": "Assigned issue",
            "assignee": teammate.id,
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["assignee"], teammate.id)
        self.assertEqual(response.data["assignee_username"], teammate.username)

        filtered = self.client.get(f"{self.url}?assignee={teammate.id}")
        self.assertEqual(filtered.status_code, status.HTTP_200_OK)
        self.assertEqual(len(filtered.data), 1)
        self.assertEqual(filtered.data[0]["id"], response.data["id"])

        outsider = User.objects.create_user(
            username="outsider", email="outsider@example.com", password="TestPass123!"
        )
        invalid = self.client.post(self.url, {
            "project": self.project.id, "title": "Invalid", "assignee": outsider.id,
        }, format="json")
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)


class ProjectMemberManagementTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner", email="owner@example.com", password="TestPass123!"
        )
        self.project = Project.objects.create(name="Members", key="MEM", owner=self.owner)
        ProjectMembership.objects.create(
            project=self.project, user=self.owner, role=ProjectMembership.Role.ADMIN
        )
        self.client.force_authenticate(user=self.owner)
        self.members_url = f"/api/v1/projects/{self.project.id}/members/"

    def test_owner_can_add_list_and_remove_member(self):
        user = User.objects.create_user(
            username="new_member", email="new@example.com", password="TestPass123!"
        )
        response = self.client.post(self.members_url, {"user_id": user.id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["username"], user.username)
        self.assertEqual(response.data["role"], ProjectMembership.Role.MEMBER)
        self.assertEqual(self.client.get(self.members_url).status_code, status.HTTP_200_OK)

        issue = Issue.objects.create(project=self.project, title="Assigned", reporter=self.owner, assignee=user)
        removed = self.client.delete(f"{self.members_url}{user.id}/")
        self.assertEqual(removed.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ProjectMembership.objects.filter(project=self.project, user=user).exists())
        issue.refresh_from_db()
        self.assertIsNone(issue.assignee)

    def test_non_admin_cannot_manage_members_and_owner_cannot_be_removed(self):
        member = User.objects.create_user(
            username="member", email="member@example.com", password="TestPass123!"
        )
        ProjectMembership.objects.create(project=self.project, user=member)
        self.client.force_authenticate(user=member)
        forbidden = self.client.post(self.members_url, {"user_id": member.id}, format="json")
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.owner)
        protected = self.client.delete(f"{self.members_url}{self.owner.id}/")
        self.assertEqual(protected.status_code, status.HTTP_400_BAD_REQUEST)
