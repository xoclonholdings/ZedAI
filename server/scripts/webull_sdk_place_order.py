import json
import logging
import os
import sys
import uuid
from contextlib import redirect_stdout


logging.basicConfig(stream=sys.stderr, level=logging.WARNING)


def emit(payload):
    print(json.dumps(payload, separators=(",", ":")))


def import_webull_sdk():
    version = sys.version_info
    if version.major != 3 or version.minor < 8 or version.minor > 13:
        return None, None, (
            "Webull OpenAPI Python SDK cannot run on this Python runtime. "
            f"Webull documents Python 3.8-3.13. Runtime: {sys.version.split()[0]}."
        )
    try:
        from webull.core.client import ApiClient
        from webull.trade.trade_client import TradeClient

        return ApiClient, TradeClient, None
    except Exception as exc:
        return None, None, f"Official Webull Python SDK is not installed or cannot load: {exc}"


def response_payload(res):
    status_code = getattr(res, "status_code", None)
    text = getattr(res, "text", "")
    try:
        data = res.json()
    except Exception:
        data = None
    return status_code, text, data


def extract_order_id(data):
    if isinstance(data, dict):
        for key in ("order_id", "orderId", "client_order_id", "clientOrderId"):
            if data.get(key):
                return str(data[key])
        inner = data.get("data")
        if isinstance(inner, dict):
            return extract_order_id(inner)
    return None


def main():
    app_key = os.environ.get("WEBULL_APP_KEY", "").strip()
    app_secret = os.environ.get("WEBULL_APP_SECRET", "").strip()
    endpoint = os.environ.get("WEBULL_API_ENDPOINT", "api.sandbox.webull.com").strip()
    region = os.environ.get("WEBULL_REGION", "us").strip() or "us"
    account_id = os.environ.get("WEBULL_ORDER_ACCOUNT_ID", "").strip()
    symbol = os.environ.get("WEBULL_ORDER_SYMBOL", "").strip().upper()
    side = os.environ.get("WEBULL_ORDER_SIDE", "BUY").strip().upper()
    qty = os.environ.get("WEBULL_ORDER_QTY", "").strip()
    order_type = os.environ.get("WEBULL_ORDER_TYPE", "LIMIT").strip().upper()
    limit_price = os.environ.get("WEBULL_ORDER_LIMIT_PRICE", "").strip()
    client_order_id = os.environ.get("WEBULL_ORDER_CLIENT_ID", "").strip() or uuid.uuid4().hex[:32]

    if not app_key or not app_secret:
        emit({"ok": False, "message": "Missing WEBULL_APP_KEY or WEBULL_APP_SECRET."})
        return
    if not account_id or not symbol or not qty:
        emit({"ok": False, "message": "Missing order fields (account id, symbol, or quantity)."})
        return

    ApiClient, TradeClient, sdk_error = import_webull_sdk()
    if sdk_error:
        emit({"ok": False, "message": sdk_error})
        return

    # Webull OpenAPI v2 stock order shape. Unknown/extra fields are ignored
    # server-side; Webull's validation errors are surfaced verbatim below.
    order = {
        "client_order_id": client_order_id,
        "symbol": symbol,
        "instrument_type": "EQUITY",
        "market": "US",
        "order_type": order_type,
        "quantity": qty,
        "side": side,
        "tif": "DAY",
        "extended_hours_trading": False,
        "entrust_type": "QTY",
    }
    if order_type == "LIMIT" and limit_price:
        order["limit_price"] = limit_price

    try:
        with redirect_stdout(sys.stderr):
            api_client = ApiClient(app_key, app_secret, region)
            api_client.add_endpoint(region, endpoint)
            trade_client = TradeClient(api_client)

            res = None
            attempts = []
            # Try the SDK's order surfaces in order of likelihood; surface
            # every failure so a field/API mismatch is diagnosable.
            for group_name, method_name, args in (
                ("order_v2", "place_order", (account_id, order)),
                ("order", "place_order", (account_id, order)),
                ("order_v2", "place_order_v2", (account_id, order)),
            ):
                group = getattr(trade_client, group_name, None)
                method = getattr(group, method_name, None) if group else None
                if not callable(method):
                    attempts.append(f"{group_name}.{method_name}: not available")
                    continue
                try:
                    res = method(*args)
                    attempts.append(f"{group_name}.{method_name}: called")
                    break
                except TypeError as sig_exc:
                    try:
                        res = method(account_id=account_id, **{"new_orders": order})
                        attempts.append(f"{group_name}.{method_name}(kwargs): called")
                        break
                    except Exception as kw_exc:
                        attempts.append(f"{group_name}.{method_name}: {sig_exc} / {kw_exc}")
                except Exception as exc:
                    attempts.append(f"{group_name}.{method_name}: {exc}")

        if res is None:
            emit({
                "ok": False,
                "message": "No usable place-order method on the Webull SDK TradeClient. " + " | ".join(attempts),
            })
            return

        status_code, text, data = response_payload(res)
        order_id = extract_order_id(data) or client_order_id
        emit({
            "ok": status_code == 200,
            "statusCode": status_code,
            "orderId": order_id,
            "clientOrderId": client_order_id,
            "message": (
                f"Webull accepted the {side} {order_type} order for {qty} {symbol} (order {order_id})."
                if status_code == 200
                else f"Webull rejected the order with HTTP {status_code}: {text[:300]}"
            ),
        })
    except Exception as exc:
        emit({"ok": False, "message": f"Webull place-order failed: {exc}"})


if __name__ == "__main__":
    main()
