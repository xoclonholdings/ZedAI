import json
import os
import sys


def emit(payload):
    print(json.dumps(payload, separators=(",", ":")))


def normalize_accounts(data):
    if isinstance(data, list):
        raw_accounts = data
    elif isinstance(data, dict) and isinstance(data.get("data"), list):
        raw_accounts = data["data"]
    elif isinstance(data, dict) and isinstance(data.get("accounts"), list):
        raw_accounts = data["accounts"]
    else:
        raw_accounts = []

    accounts = []
    for index, account in enumerate(raw_accounts):
        if not isinstance(account, dict):
            account = {"value": account}
        account_id = (
            account.get("account_id")
            or account.get("accountId")
            or account.get("id")
            or f"account-{index + 1}"
        )
        account_type = account.get("account_type") or account.get("accountType") or account.get("type") or "unknown"
        accounts.append(
            {
                "id": str(account_id),
                "label": str(account_type),
                "type": str(account_type),
                "raw": account,
            }
        )
    return accounts


def main():
    app_key = os.environ.get("WEBULL_APP_KEY", "").strip()
    app_secret = os.environ.get("WEBULL_APP_SECRET", "").strip()
    endpoint = os.environ.get("WEBULL_API_ENDPOINT", "api.sandbox.webull.com").strip()
    region = os.environ.get("WEBULL_REGION", "us").strip() or "us"

    if not app_key or not app_secret:
        emit({"ok": False, "accounts": [], "message": "Missing WEBULL_APP_KEY or WEBULL_APP_SECRET."})
        return

    try:
        from webull.core.client import ApiClient
        from webull.trade.trade_client import TradeClient
    except Exception as exc:
        emit(
            {
                "ok": False,
                "accounts": [],
                "message": (
                    "Official Webull Python SDK is not installed or cannot load. "
                    "Install with: pip3 install --upgrade webull-openapi-python-sdk. "
                    "Webull documents Python 3.8-3.13 for this SDK. "
                    f"Runtime: {sys.version.split()[0]}. Error: {exc}"
                ),
            }
        )
        return

    try:
        api_client = ApiClient(app_key, app_secret, region)
        api_client.add_endpoint(region, endpoint)
        trade_client = TradeClient(api_client)
        res = trade_client.account_v2.get_account_list()
        status_code = getattr(res, "status_code", None)
        text = getattr(res, "text", "")
        data = res.json()
        accounts = normalize_accounts(data)
        emit(
            {
                "ok": status_code == 200,
                "statusCode": status_code,
                "accounts": accounts,
                "message": (
                    f"Webull SDK account-list test succeeded ({len(accounts)} account(s) returned)."
                    if status_code == 200
                    else f"Webull SDK account-list test failed with HTTP {status_code}: {text[:240]}"
                ),
            }
        )
    except Exception as exc:
        emit(
            {
                "ok": False,
                "accounts": [],
                "message": f"Webull SDK account-list test failed: {exc}",
            }
        )


if __name__ == "__main__":
    main()
