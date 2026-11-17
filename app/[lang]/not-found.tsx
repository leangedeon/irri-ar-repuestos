import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="page">
      <div className="empty big">
        <h1>No encontrado · Not found</h1>
        <p>La página que buscás no existe. · This page does not exist.</p>
        <Link className="btn btn-primary" href="/">
          Inicio · Home
        </Link>
      </div>
    </div>
  );
}
