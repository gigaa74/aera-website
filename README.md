<div align="center">

# AERA · Website

**Сайт, личный кабинет, оплата и поддержка**

[Открыть сайт](https://aera-reserve.duckdns.org) · [Telegram-бот](https://t.me/AERAVPN_BOT) · [Backend бота](https://github.com/gigaa74/aera-bot)

![Python](https://img.shields.io/badge/Python-3.12%2B-40d5f7) ![API](https://img.shields.io/badge/API-FastAPI-40d5f7) ![UI](https://img.shields.io/badge/UI-JavaScript_%2B_CSS-40d5f7)

</div>

## Что внутри

- Адаптивный интерфейс AERA в тёмной теме с голубыми акцентами.
- Страницы тарифов, подключения и документов.
- Личный кабинет с Telegram-авторизацией.
- Короткая форма оплаты и интеграция с backend бота.
- Тикет-система поддержки и отдельная страница администратора.

## Локальный просмотр

Требуется Python 3.12+.

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:AERA_WEB_ORIGIN="http://127.0.0.1:8765"
$env:AERA_WEB_BACKEND="0"
$env:AERA_WEB_SUPPORT_DB="./support.sqlite3"
uvicorn aera_web.server:app --host 127.0.0.1 --port 8765 --no-access-log
```

Откройте http://127.0.0.1:8765. В автономном режиме доступен интерфейс; тарифы из базы, вход, кабинет и реальная оплата требуют подключённого backend.

## Структура

| Путь | Назначение |
| --- | --- |
| `aera_web/server.py` | HTTP-маршруты и защитные заголовки |
| `aera_web/auth.py` | Telegram-авторизация |
| `aera_web/repository.py` | Чтение данных кабинета |
| `aera_web/support*.py` | Обращения и ответы поддержки |
| `aera_web/static` | HTML, CSS, JavaScript и изображения |
| `.env.example` | Перечень настроек без секретов |

## Подключённый режим

Установите [backend бота](https://github.com/gigaa74/aera-bot) в том же Python-окружении через `pip install -e ../aera-bot`. Задайте переменные из `.env.example`, включите `AERA_WEB_BACKEND=1`, настройте PostgreSQL, Redis и Telegram-авторизацию. Файл `.env.example` служит справочником: приложение читает переменные окружения, поэтому загрузите их выбранным способом запуска.

Сайт и backend используют общую базу моделей и согласованный секрет приложения. Для checkout задаётся одинаковый `AERA_CHECKOUT_BRIDGE_KEY` в обоих процессах; API бота должен быть доступен на `127.0.0.1:8000`. В production нужны HTTPS, корректный origin и закрытые настройки сервера.

Публичная копия исходников выгружена 7 октября 2026 года из работающего проекта. Рабочие секреты, пользовательские данные, SQLite-базы и конфигурация сервера не включены.

## Безопасность

См. [SECURITY.md](SECURITY.md). Платёж подтверждает сервер через провайдера; открытие страницы успеха само по себе не подтверждает оплату.
