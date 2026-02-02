"""
מחירוני ספקים - כל ספק עם המוצרים והמחירים שלו
"""

SUPPLIERS = {
    "שמפנה זהל": {
        "name": "שמפנה זהל",
        "products": [
            {"catalog_number": "1001", "description": "שמפניה ברוט קלאסיק 750 מ\"ל", "unit": "בקבוק", "price": 89.90},
            {"catalog_number": "1002", "description": "שמפניה רוזה 750 מ\"ל", "unit": "בקבוק", "price": 99.90},
            {"catalog_number": "1003", "description": "שמפניה דמי סק 750 מ\"ל", "unit": "בקבוק", "price": 85.00},
            {"catalog_number": "1004", "description": "שמפניה ברוט רזרב 750 מ\"ל", "unit": "בקבוק", "price": 120.00},
            {"catalog_number": "1005", "description": "שמפניה מוסקטו 750 מ\"ל", "unit": "בקבוק", "price": 75.00},
            {"catalog_number": "1006", "description": "שמפניה ברוט מיני 200 מ\"ל", "unit": "בקבוק", "price": 35.00},
            {"catalog_number": "1007", "description": "שמפניה רוזה מיני 200 מ\"ל", "unit": "בקבוק", "price": 38.00},
            {"catalog_number": "1008", "description": "שמפניה ברוט מגנום 1.5 ליטר", "unit": "בקבוק", "price": 180.00},
            {"catalog_number": "1009", "description": "קאווה ברוט 750 מ\"ל", "unit": "בקבוק", "price": 55.00},
            {"catalog_number": "1010", "description": "פרוסקו 750 מ\"ל", "unit": "בקבוק", "price": 65.00},
            {"catalog_number": "1011", "description": "אסטי ספומנטה 750 מ\"ל", "unit": "בקבוק", "price": 70.00},
            {"catalog_number": "1012", "description": "שמפניה בלאן דה בלאן 750 מ\"ל", "unit": "בקבוק", "price": 150.00},
        ],
    }
}


def get_supplier_names():
    """מחזיר רשימת שמות ספקים"""
    return list(SUPPLIERS.keys())


def get_supplier_products(supplier_name):
    """מחזיר את רשימת המוצרים של ספק"""
    supplier = SUPPLIERS.get(supplier_name)
    if supplier:
        return supplier["products"]
    return []


def search_products(supplier_name, query):
    """חיפוש מוצרים לפי תיאור - להשלמה אוטומטית"""
    products = get_supplier_products(supplier_name)
    if not query:
        return products
    query = query.strip()
    return [p for p in products if query in p["description"] or query in p["catalog_number"]]
