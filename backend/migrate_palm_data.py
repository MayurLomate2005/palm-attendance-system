"""
Standalone Migration Script — Run ONCE after upgrading to 99-feature pipeline.

What it does:
  1. Connects directly to the SQLite DB
  2. Deletes all palm_features rows where vector size != 99
  3. Deletes old model.pkl / scaler.pkl / label_encoder.pkl
  4. Prints a summary

Usage (from backend/ folder):
    venv\Scripts\python.exe migrate_palm_data.py
"""
import os
import sys
import json
import sqlite3

BASE_DIR   = os.path.abspath(os.path.dirname(__file__))
DB_PATH    = os.path.join(BASE_DIR, "palm_attendance.db")
ML_DIR     = os.path.join(BASE_DIR, "ml_model")
MODEL_FILES = ["model.pkl", "scaler.pkl", "label_encoder.pkl"]

REQUIRED_FEATURE_SIZE = 99


def main():
    print("=" * 60)
    print("PALM BIOMETRIC - ONE-TIME MIGRATION TO 99-FEATURE PIPELINE")
    print("=" * 60)

    if not os.path.exists(DB_PATH):
        print(f"ERROR: Database not found at {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()

    # ── 1. Read all palm_features rows ────────────────────────────────────
    cur.execute("SELECT id, user_id, feature_vector FROM palm_features")
    rows = cur.fetchall()
    print(f"\nTotal palm_features rows in DB: {len(rows)}")

    legacy_ids  = []
    valid_count = 0

    for row_id, user_id, fv_json in rows:
        try:
            vec = json.loads(fv_json)
            if len(vec) == REQUIRED_FEATURE_SIZE:
                valid_count += 1
            else:
                legacy_ids.append((row_id, user_id, len(vec)))
        except Exception:
            legacy_ids.append((row_id, user_id, -1))

    print(f"  Valid ({REQUIRED_FEATURE_SIZE}-feature) rows : {valid_count}")
    print(f"  Legacy / bad rows to delete      : {len(legacy_ids)}")

    if not legacy_ids:
        print("\nNothing to migrate — all rows are already 99-feature vectors.")
        print("You can re-register palms and train the model now.")
        conn.close()
        return

    # ── 2. Delete legacy rows ─────────────────────────────────────────────
    ids_to_delete = [r[0] for r in legacy_ids]
    placeholders  = ",".join("?" * len(ids_to_delete))
    cur.execute(f"DELETE FROM palm_features WHERE id IN ({placeholders})", ids_to_delete)
    conn.commit()
    print(f"\nDeleted {len(ids_to_delete)} legacy palm_features rows.")

    for row_id, user_id, size in legacy_ids:
        print(f"  - Row ID {row_id}, User ID {user_id}, vector size was {size}")

    # ── 3. Delete old model files ─────────────────────────────────────────
    print("\nCleaning up old model files...")
    for fname in MODEL_FILES:
        fpath = os.path.join(ML_DIR, fname)
        if os.path.exists(fpath):
            os.remove(fpath)
            print(f"  Deleted: {fpath}")
        else:
            print(f"  Not found (OK): {fpath}")

    conn.close()

    # ── 4. Summary ────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("MIGRATION COMPLETE!")
    print("=" * 60)
    print("\nNext steps:")
    print("  1. Restart the Flask backend (python app.py)")
    print("  2. Each user must RE-REGISTER their palm (5+ samples)")
    print("  3. Admin trains the model via the UI or POST /api/palm/train")
    print("  4. Authentication should now work with high accuracy")
    print()


if __name__ == "__main__":
    main()
