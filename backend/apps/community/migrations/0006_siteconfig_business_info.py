from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('community', '0005_siteconfig'),
    ]

    operations = [
        migrations.AddField(
            model_name='siteconfig',
            name='business_name',
            field=models.CharField(default='모루', max_length=100, verbose_name='상호'),
        ),
        migrations.AddField(
            model_name='siteconfig',
            name='representative',
            field=models.CharField(blank=True, default='', max_length=50, verbose_name='대표'),
        ),
        migrations.AddField(
            model_name='siteconfig',
            name='business_number',
            field=models.CharField(blank=True, default='', max_length=50, verbose_name='사업자등록번호'),
        ),
        migrations.AddField(
            model_name='siteconfig',
            name='location_service_number',
            field=models.CharField(blank=True, default='', max_length=50, verbose_name='위치기반서비스 신고번호'),
        ),
        migrations.AddField(
            model_name='siteconfig',
            name='telecom_number',
            field=models.CharField(blank=True, default='', max_length=50, verbose_name='통신판매업 신고번호'),
        ),
        migrations.AddField(
            model_name='siteconfig',
            name='contact_email',
            field=models.CharField(default='contact@moruwalk.com', max_length=100, verbose_name='이메일'),
        ),
    ]
