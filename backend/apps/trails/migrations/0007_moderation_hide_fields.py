from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('trails', '0006_alter_collection_options_alter_tag_options_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='trail',
            name='is_hidden',
            field=models.BooleanField(default=False, db_index=True),
        ),
        migrations.AddField(
            model_name='trail',
            name='hidden_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='trail',
            name='hidden_reason',
            field=models.CharField(blank=True, default='', max_length=200),
        ),
    ]
