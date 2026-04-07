from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('community', '0002_post_bookmark_count_postcomment_is_deleted_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='Notice',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('content', models.TextField()),
                ('is_pinned', models.BooleanField(default=False)),
                ('is_published', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['-is_pinned', '-created_at'],
            },
        ),
    ]
