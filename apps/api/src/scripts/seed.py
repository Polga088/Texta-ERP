from __future__ import annotations

"""Bootstrap demo organization and admin user."""
import asyncio
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from src.core.config import get_settings
from src.core.database import async_session_maker
from src.core.security import get_password_hash
from src.models.calendar import CalendarEvent, EventAttendee
from src.models.crm import Account, Contact, Project, ProjectStatus
from src.models.hr import Department, Employee, EmploymentStatus, LeaveRequest, LeaveStatus
from src.models.organization import GlobalRole, Group, GroupMember, Organization, User
from src.models.permissions import GranteeType, ProjectPermission, ProjectPermissionGrant
from src.models.task import Task, TaskPriority, TaskStatus

settings = get_settings()


async def seed() -> None:
    async with async_session_maker() as db:
        existing = await db.execute(select(Organization).where(Organization.slug == "texta-demo"))
        if existing.scalar_one_or_none():
            print("Seed déjà appliqué (org texta-demo existe).")
            return

        org = Organization(name="Texta Demo", slug="texta-demo")
        db.add(org)
        await db.flush()

        admin = User(
            organization_id=org.id,
            email=settings.admin_email,
            hashed_password=get_password_hash(settings.admin_password),
            full_name="Admin Texta",
            global_role=GlobalRole.ADMIN,
        )
        pm = User(
            organization_id=org.id,
            email="pm@texta.local",
            hashed_password=get_password_hash("Pm123456!"),
            full_name="Chef de Projet",
            global_role=GlobalRole.PROJECT_MANAGER,
        )
        member = User(
            organization_id=org.id,
            email="member@texta.local",
            hashed_password=get_password_hash("Member123!"),
            full_name="Membre Équipe",
            global_role=GlobalRole.MEMBER,
        )
        hr = User(
            organization_id=org.id,
            email="hr@texta.local",
            hashed_password=get_password_hash("Hr123456!"),
            full_name="Responsable RH",
            global_role=GlobalRole.HR_MANAGER,
        )
        db.add_all([admin, pm, member, hr])
        await db.flush()

        dev_group = Group(organization_id=org.id, name="Équipe Dev", description="Développement")
        db.add(dev_group)
        await db.flush()
        db.add_all([
            GroupMember(group_id=dev_group.id, user_id=pm.id),
            GroupMember(group_id=dev_group.id, user_id=member.id),
        ])

        account = Account(
            organization_id=org.id,
            name="Acme Corp",
            industry="Technologie",
            website="https://acme.example",
        )
        db.add(account)
        await db.flush()

        db.add(Contact(
            organization_id=org.id,
            account_id=account.id,
            full_name="Jean Dupont",
            email="jean@acme.example",
            job_title="Directeur",
        ))

        project = Project(
            organization_id=org.id,
            account_id=account.id,
            name="Refonte Portail Client",
            description="Projet CRM+ERP Texta",
            status=ProjectStatus.ACTIVE,
            owner_id=pm.id,
            start_date=date.today(),
        )
        db.add(project)
        await db.flush()

        db.add(ProjectPermissionGrant(
            organization_id=org.id,
            project_id=project.id,
            grantee_type=GranteeType.GROUP,
            grantee_id=dev_group.id,
            permissions=[ProjectPermission.VIEW.value, ProjectPermission.EDIT_TASKS.value],
            granted_by_id=pm.id,
        ))

        tasks_data = [
            ("Configurer l'environnement", TaskStatus.DONE, TaskPriority.HIGH, 0),
            ("Modèle RBAC habilitations", TaskStatus.IN_PROGRESS, TaskPriority.HIGH, 1),
            ("UI Kanban tâches", TaskStatus.TODO, TaskPriority.MEDIUM, 2),
            ("Module RH congés", TaskStatus.TODO, TaskPriority.MEDIUM, 3),
        ]
        for title, status, priority, pos in tasks_data:
            db.add(Task(
                organization_id=org.id,
                project_id=project.id,
                title=title,
                status=status,
                priority=priority,
                position=pos,
                assignee_id=member.id if pos % 2 else pm.id,
                created_by_id=pm.id,
            ))

        dept_eng = Department(organization_id=org.id, name="Ingénierie")
        dept_hr = Department(organization_id=org.id, name="Ressources Humaines")
        db.add_all([dept_eng, dept_hr])
        await db.flush()

        emp_pm = Employee(
            organization_id=org.id,
            user_id=pm.id,
            department_id=dept_eng.id,
            employee_number="EMP-001",
            job_title="Chef de Projet",
            hire_date=date(2024, 1, 15),
            contract_type="CDI",
            status=EmploymentStatus.ACTIVE,
        )
        db.add(emp_pm)
        await db.flush()

        db.add(Employee(
            organization_id=org.id,
            user_id=member.id,
            department_id=dept_eng.id,
            manager_id=emp_pm.id,
            employee_number="EMP-002",
            job_title="Développeur",
            hire_date=date(2024, 6, 1),
            contract_type="CDI",
        ))

        db.add(LeaveRequest(
            organization_id=org.id,
            employee_id=emp_pm.id,
            leave_type="Congés payés",
            start_date=date.today() + timedelta(days=30),
            end_date=date.today() + timedelta(days=35),
            reason="Vacances été",
            status=LeaveStatus.SUBMITTED,
        ))

        now = datetime.now(timezone.utc)
        event = CalendarEvent(
            organization_id=org.id,
            project_id=project.id,
            title="Réunion lancement sprint",
            description="Point hebdomadaire équipe",
            meeting_url="https://meet.example/abc",
            start_at=now + timedelta(days=1, hours=10),
            end_at=now + timedelta(days=1, hours=11),
            organizer_id=pm.id,
        )
        db.add(event)
        await db.flush()
        db.add_all([
            EventAttendee(event_id=event.id, user_id=pm.id, response_status="accepted"),
            EventAttendee(event_id=event.id, user_id=member.id, response_status="pending"),
        ])

        await db.commit()
        print(f"Seed OK — org={org.slug}")
        print(f"  Admin: {settings.admin_email} / {settings.admin_password}")
        print("  PM: pm@texta.local / Pm123456!")
        print("  Member: member@texta.local / Member123!")


if __name__ == "__main__":
    asyncio.run(seed())
