
select public.grant_editor_by_email('info@bwd.ac.th');
update public.users set role='admin' where line_user_id='Ufddbeb55626ebb588a50bf3824bef79f';
insert into public.users(line_user_id, display_name, email, role, classroom, phone, picture_url) values
('Uxxxx01', 'ครูหนึ่ง', 'one@school.ac.th', 'teacher', 'ม.1/1', '080-111-1111', null),
('Uxxxx02', 'ครูสอง', 'two@school.ac.th', 'teacher', 'ม.2/2', '080-222-2222', null);
