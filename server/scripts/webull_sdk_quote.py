import json
import os
import sys
from datetime import datetime, timezone


def emit(payload):
    print(json.dumps(payload, separators=(",", ":")))


def first_number(obj, keys):
    if isinstance(obj, dict):
        for key in keys:
            value = obj.get(key)
            try:
                if value is not None and float(value) > 0:
                    return float(value)
            except Exception:
                pass
        for value in obj.values():
            found = first_number(value, keys)
            if found:
                return found
    elif isinstance(obj, list):
        for value in obj:
            found = first_number(value, keys)
            if found:
                return found
    return None


def first_text(obj, keys):
    if isinstance(obj, dict):
        for key in keys:
            value = obj.get(key)
            if value:
                return str(value)
        for value in obj.values():
            found = first_text(value, keys)
            if found:
                return found
    elif isinstance(obj, list):
        for value in obj:
            found = first_text(value, keys)
            if found:
                return found
    return None


def parse_bar(row):
    if not isinstance(row, dict):
        return None
    aliases = {
        "o": ("o", "open", "openPrice"),
        "h": ("h", "high", "highPrice"),
        "l": ("l", "low", "lowPrice"),
        "c": ("c", "close", "closePrice", "last", "lastPrice"),
    }
    parsed = {}
    for out_key, names in aliases.items():
        for name in names:
            try:
                value = row.get(name)
                if value is not None and float(value) > 0:
                    parsed[out_key] = float(value)
                    break
            except Exception:
                pass
    return parsed if all(key in parsed for key in ("o", "h", "l", "c")) else None


def find_bars(obj):
    if isinstance(obj, list):
        bars = [parse_bar(item) for item in obj]
        bars = [bar for bar in bars if bar]
        if len(bars) >= 2:
            return bars
        for item in obj:
            found = find_bars(item)
            if found:
                return found
    elif isinstance(obj, dict):
        for key in ("data", "bars", "items", "list", "results"):
            found = find_bars(obj.get(key))
            if found:
                return found
        for value in obj.values():
            found = find_bars(value)
            if found:
                return found
    return []


def category_for(asset):
    asset = (asset or "stock").lower()
    if asset == "etf":
        return "US_ETF"
    if asset == "crypto":
        return "US_CRYPTO"
    if asset == "future":
        return "US_FUTURES"
    if asset == "option":
        return "US_OPTION"
    return "US_STOCK"


def response_json(response):
    try:
        return response.json()
    except Exception:
        return None


def main():
    app_key = os.environ.get("WEBULL_APP_KEY", "").strip()
    app_secret = os.environ.get("WEBULL_APP_SECRET", "").strip()
    endpoint = os.environ.get("WEBULL_API_ENDPOINT", "api.sandbox.webull.com").strip()
    region = os.environ.get("WEBULL_REGION", "us").strip() or "us"
    symbol = os.environ.get("WEBULL_SYMBOL", "").strip().upper()
    asset = os.environ.get("WEBULL_ASSET", "stock").strip().lower()

    if not app_key or not app_secret:
        emit({"ok": False, "message": "Missing WEBULL_APP_KEY or WEBULL_APP_SECRET."})
        return
    if not symbol:
        emit({"ok": False, "message": "Missing WEBULL_SYMBOL."})
        return

    try:
        from webull.core.client import ApiClient
        from webull.data.common.category import Category
        from webull.data.common.timespan import Timespan
        from webull.data.data_client import DataClient
    except Exception as exc:
        emit(
            {
                "ok": False,
                "message": (
                    "Official Webull Python SDK is not installed or cannot load. "
                    "Install with: pip3 install --upgrade webull-openapi-python-sdk. "
                    f"Runtime: {sys.version.split()[0]}. Error: {exc}"
                ),
            }
        )
        return

    try:
        api_client = ApiClient(app_key, app_secret, region)
        api_client.add_endpoint(region, endpoint)
        data_client = DataClient(api_client)
        category = getattr(Category, category_for(asset)).name

        snapshot = None
        history = None
        if asset == "crypto":
            snapshot_res = data_client.crypto_market_data.get_crypto_snapshot(symbol)
            history_res = data_client.crypto_market_data.get_crypto_history_bar(symbol, category, Timespan.D.name)
        elif asset == "future":
            snapshot_res = data_client.futures_market_data.get_futures_snapshot(symbol, category)
            history_res = data_client.futures_market_data.get_futures_history_bars(symbol, category, Timespan.D.name)
        elif asset == "option":
            snapshot_res = data_client.option_market_data.get_option_snapshot(symbol, category)
            history_res = data_client.option_market_data.get_option_history_bars(symbol, category, Timespan.D.name)
        else:
            snapshot_res = data_client.market_data.get_snapshot(symbol, category, extend_hour_required=True, overnight_required=True)
            history_res = data_client.market_data.get_history_bar(symbol, category, Timespan.D.name, count="60")

        snapshot = response_json(snapshot_res)
        history = response_json(history_res)
        price = first_number(snapshot, ("lastPrice", "last", "close", "closePrice", "price", "tradePrice", "pPrice"))
        bars = find_bars(history)
        if not price and bars:
            price = bars[-1]["c"]
        if not price:
            emit(
                {
                    "ok": False,
                    "statusCode": getattr(snapshot_res, "status_code", None),
                    "message": f"Webull returned no usable price for {symbol}. Snapshot: {str(snapshot)[:240]}",
                }
            )
            return

        emit(
            {
                "ok": True,
                "quote": {
                    "symbol": first_text(snapshot, ("symbol", "ticker", "code")) or symbol,
                    "price": round(price, 4),
                    "asOf": datetime.now(timezone.utc).isoformat(),
                    "source": "Webull OpenAPI",
                    "bars": bars[-60:],
                },
            }
        )
    except Exception as exc:
        emit({"ok": False, "message": f"Webull market-data SDK request failed for {symbol}: {exc}"})


if __name__ == "__main__":
    main()
