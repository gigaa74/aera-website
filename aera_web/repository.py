"""Read-only adapter to the inspected AERA SQLAlchemy schema.

Use a DB role with SELECT grants only. No service imports, panel clients, commits,
seeding, migrations, payment creation, fulfillment or VPN provisioning.
"""
from datetime import UTC, datetime, timedelta
from sqlalchemy import select
from app.db.models import User, Plan, Payment, Subscription, VPNClient, PaidLink, ManualAccess, TrialLink, SaleOrder, SupportTicket
from app.core.security import TokenVault


def utc(value):
    return value.replace(tzinfo=UTC) if value and value.tzinfo is None else value


def iso(value):
    return utc(value).isoformat() if value else None


def plan_data(p):
    return {"id": p.id, "name": p.name, "slug": p.slug, "price_minor": p.price_minor,
            "currency": p.currency, "duration_months": p.duration_months,
            "duration_days": p.duration_days, "device_limit": p.device_limit,
            "unlimited_devices": p.unlimited_devices, "traffic_limit_bytes": p.traffic_limit_bytes}


class Repository:
    def __init__(self, sessions, secret, subscription_origin=""):
        self.sessions, self.vault = sessions, TokenVault(secret)
        self.subscription_origin = subscription_origin

    async def find_user(self, telegram_id):
        async with self.sessions() as db:
            user = await db.scalar(select(User).where(User.telegram_id == telegram_id))
            return user.id if user and user.is_active and not user.is_blocked else None

    async def support_admin(self, user_id, admin_ids):
        async with self.sessions() as db:
            user = await db.get(User, user_id)
            return bool(user and user.is_active and not user.is_blocked and user.telegram_id in admin_ids)

    async def catalog(self):
        async with self.sessions() as db:
            plans = await db.scalars(select(Plan).where(Plan.is_active.is_(True)).order_by(Plan.sort_order, Plan.price_minor))
            return [plan_data(p) for p in plans]

    async def account(self, user_id, include_connection=False):
        async with self.sessions() as db:
            user = await db.get(User, user_id)
            if not user or not user.is_active or user.is_blocked:
                return None
            now = datetime.now(UTC)
            paid = await db.scalar(select(PaidLink).where(PaidLink.user_id == user.id, PaidLink.issued_at.is_not(None)).order_by(PaidLink.issued_at.desc(), PaidLink.id.desc()).limit(1))
            manual = await db.scalar(select(ManualAccess).where(ManualAccess.user_id == user.id))
            trial = await db.scalar(select(TrialLink).where(TrialLink.user_id == user.id))
            sub = await db.scalar(select(Subscription).where(Subscription.user_id == user.id))
            current, encrypted, direct = None, None, None
            # Match portal precedence; never fall back to an older key after a blocked paid key.
            if paid or manual or trial:
                row = paid or manual or trial
                is_pool = row is paid or row is trial
                fresh = bool(is_pool and row.checked_at and utc(row.checked_at) > now - timedelta(minutes=2))
                expired = bool(row.expires_at and utc(row.expires_at) <= now)
                status = ("EXPIRED" if expired else row.status if fresh else "UNKNOWN") if is_pool else ("EXPIRED" if expired else "ACTIVE")
                plan = await db.get(Plan, row.plan_id) if row is not trial else None
                current = {"plan": plan_data(plan) if plan else None, "label": plan.name if plan else "Пробный доступ",
                           "status": status, "expires_at": iso(row.expires_at), "checked_at": iso(row.checked_at) if is_pool else None,
                           "duration_ms": getattr(row, "duration_ms", None), "traffic_used_bytes": None}
                if status in {"ACTIVE", "WAITING"}:
                    encrypted = row.link_encrypted
            elif sub:
                plan = await db.get(Plan, sub.plan_id)
                client = await db.scalar(select(VPNClient).where(VPNClient.subscription_id == sub.id))
                active = sub.status in {"ACTIVE", "EXPIRING", "TRIAL"} and utc(sub.expires_at) > now
                current = {"plan": plan_data(plan) if plan else None, "label": plan.name if plan else "AERA",
                           "status": sub.status if utc(sub.expires_at) > now else "EXPIRED", "expires_at": iso(sub.expires_at),
                           "checked_at": None, "traffic_used_bytes": client.traffic_used_bytes if client else None}
                quota_ok = client and (client.traffic_limit_bytes == 0 or client.traffic_used_bytes < client.traffic_limit_bytes)
                if active and client and client.enabled and quota_ok and client.token_encrypted and self.subscription_origin:
                    if include_connection:
                        direct = self.subscription_origin + "/sub/" + self.vault.reveal(client.token_encrypted)
                    else:
                        direct = True
            payments = await db.scalars(select(Payment).where(Payment.user_id == user.id, Payment.status == "PAID").order_by(Payment.created_at.desc()).limit(100))
            history = [{"id": p.id, "amount_minor": p.amount_minor, "currency": p.currency, "status": p.status,
                        "provider": p.provider, "created_at": iso(p.created_at), "paid_at": iso(p.paid_at)} for p in payments]
            # Manual bank orders without Payment rows are real payment history too.
            orders = await db.scalars(select(SaleOrder).join(SupportTicket, SaleOrder.ticket_id == SupportTicket.id).where(SupportTicket.user_id == user.id, SaleOrder.payment_id.is_(None), SaleOrder.paid_at.is_not(None)).order_by(SaleOrder.created_at.desc()).limit(100))
            history += [{"id": o.id, "amount_minor": o.amount_rub_minor, "currency": "RUB", "status": "PAID" if o.paid_at else "PENDING",
                         "provider": "manual", "created_at": iso(o.created_at), "paid_at": iso(o.paid_at)} for o in orders]
            history.sort(key=lambda p: p["created_at"], reverse=True)
            result = {"user": {"name": user.first_name or user.username or "Пользователь AERA"},
                      "subscription": current, "payments": history[:100], "connection_available": bool(encrypted or direct)}
            if include_connection:
                result["connection"] = self.vault.reveal(encrypted) if encrypted else direct
            return result
