"""Local publish receipts for batch listing publish.

The project has not connected Shopee/TikTok Shop/TEMU write APIs yet. These
helpers make that explicit in both persisted listing data and API responses,
instead of letting a local draft look like a platform publish success.
"""

LOCAL_PLATFORM_API_STATUS = "not_connected"
LOCAL_PLATFORM_PUBLISH_STATUS = "not_attempted"


def build_local_publish_receipt(
    *,
    status: str,
    message: str,
    publish_plan: dict | None,
    retryable: bool,
    next_action: str,
    receipt_source: str,
    listing_id: str | None = None,
    platform_account_id: str | None = None,
    store_name: str | None = None,
) -> dict:
    plan = publish_plan or {}
    return {
        "status": status,
        "platform_api_status": LOCAL_PLATFORM_API_STATUS,
        "platform_publish_status": LOCAL_PLATFORM_PUBLISH_STATUS,
        "retryable": retryable,
        "next_action": next_action,
        "receipt_source": receipt_source,
        "listing_id": listing_id,
        "platform_account_id": platform_account_id,
        "store_name": store_name,
        "mode": plan.get("mode"),
        "plan_status": plan.get("status"),
        "message": message,
    }


def skipped_publish_result(
    draft: dict,
    *,
    error: str,
    publish_plan: dict | None,
    data_gaps: list[str] | None = None,
    validation_checks: list[dict] | None = None,
    retryable: bool = True,
) -> dict:
    receipt = build_local_publish_receipt(
        status="skipped",
        message=error,
        publish_plan=publish_plan,
        retryable=retryable,
        next_action="补齐Listing字段、定价、图片、SKU或目标店铺后返回批量刊登重试",
        receipt_source="local_validation",
    )
    result = {
        **draft,
        "publish_status": "skipped",
        "error": error,
        "publish_plan": publish_plan,
        "plan_status": (publish_plan or {}).get("status"),
        "platform_api_status": LOCAL_PLATFORM_API_STATUS,
        "platform_publish_status": LOCAL_PLATFORM_PUBLISH_STATUS,
        "publish_receipt": receipt,
        "retryable": retryable,
        "retry_action": "repair_and_retry_batch_publish",
    }
    if data_gaps is not None:
        result["data_gaps"] = list(dict.fromkeys([*(draft.get("data_gaps") or []), *data_gaps]))
    if validation_checks is not None:
        result["validation_checks"] = validation_checks
    return result
