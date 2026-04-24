"""
기존 trail 레코드들의 visibility 백필.

0017 에서 visibility 필드가 default='private' 로 추가되면서
운영 DB 의 기존 554개 코스(Durunubi 공식 포함)가 모두 'private' 로 남았고,
그 결과 anonymous 요청에 목록이 비어 보이는 버그가 발생했다.

이 마이그레이션은 **이미 status='approved' 상태이거나 is_official=True
인 레코드**만 'public' 으로 되돌린다. draft/pending/rejected 는 그대로
private 로 둬서 의도치 않은 공개를 방지.
"""
from django.db import migrations


def backfill_public(apps, schema_editor):
    Trail = apps.get_model("trails", "Trail")
    Trail.objects.filter(status="approved").update(visibility="public")
    Trail.objects.filter(is_official=True).update(visibility="public")


def reverse_noop(apps, schema_editor):
    # 되돌리는 건 위험(유저가 중간에 나만 보기로 바꿨을 수 있음). no-op.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("trails", "0017_trail_visibility"),
    ]
    operations = [
        migrations.RunPython(backfill_public, reverse_noop),
    ]
