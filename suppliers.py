"""
מחירוני ספקים - שמירה וטעינה מקובץ JSON
"""
import json
import os

SUPPLIERS_FILE = "suppliers_data.json"


def _load_suppliers():
    """טוען את כל הספקים מהקובץ"""
    if not os.path.exists(SUPPLIERS_FILE):
        return {}
    with open(SUPPLIERS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_suppliers(data):
    """שומר את כל הספקים לקובץ"""
    with open(SUPPLIERS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_supplier_names():
    """מחזיר רשימת שמות ספקים"""
    return list(_load_suppliers().keys())


def get_supplier(supplier_name):
    """מחזיר את כל פרטי הספק"""
    return _load_suppliers().get(supplier_name)


def get_supplier_products(supplier_name):
    """מחזיר את רשימת המוצרים של ספק"""
    supplier = get_supplier(supplier_name)
    if supplier:
        return supplier.get("products", [])
    return []


def search_products(supplier_name, query):
    """חיפוש מוצרים לפי תיאור - להשלמה אוטומטית"""
    products = get_supplier_products(supplier_name)
    if not query:
        return products
    query = query.strip()
    return [p for p in products if query in p["description"] or query in p.get("catalog_number", "")]


def save_supplier(name, supplier_number="", contact_name="", phone="", email="",
                   address="", contract="", notes="", products=None):
    """שמירת ספק חדש או עדכון קיים"""
    data = _load_suppliers()
    data[name] = {
        "name": name,
        "supplier_number": supplier_number,
        "contact_name": contact_name,
        "phone": phone,
        "email": email,
        "address": address,
        "contract": contract,
        "notes": notes,
        "products": products or [],
    }
    _save_suppliers(data)


def delete_supplier(name):
    """מחיקת ספק"""
    data = _load_suppliers()
    if name in data:
        del data[name]
        _save_suppliers(data)
