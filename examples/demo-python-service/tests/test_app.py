from order_service.app import classify_order_status


def test_classify_order_status():
    assert classify_order_status("paid") == "active"
    assert classify_order_status("cancelled") == "closed"
    assert classify_order_status("manual-review") == "review"
