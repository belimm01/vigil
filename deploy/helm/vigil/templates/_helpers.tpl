{{- define "vigil.fullname" -}}{{ .Release.Name }}-vigil{{- end }}
{{- define "vigil.labels" -}}
app.kubernetes.io/name: vigil
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}
{{- define "vigil.nginxConfig" -}}
server {
  listen 8080;
  root /usr/share/nginx/html;
  location /api/ {
    proxy_pass http://{{ include "vigil.fullname" . }}-api:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  location / { try_files $uri $uri/ /index.html; }
}
{{- end }}
