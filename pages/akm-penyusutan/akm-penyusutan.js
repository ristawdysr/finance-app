const penyusutanLabel = String(localStorage.getItem("menuLabel") || "").toLowerCase()

window.initAkmPenyusutan = window.createPenyusutanPage({
  jenisAset: penyusutanLabel.includes("kendaraan") ? "kendaraan" : "inventaris",
  pageTitle: localStorage.getItem("menuLabel") || "Akumulasi Penyusutan",
  companyName: localStorage.getItem("activeCompanyName") || "Nama Perusahaan",
  emptyLabel: localStorage.getItem("menuLabel") || "aset",
  editFnName: "editAkmPenyusutanUmum",
  deleteFnName: "deleteAkmPenyusutanUmum",
  ids: {
    companyTitle: "penyusutanCompanyTitle",
    subtitle: "penyusutanSubtitle",
    filterTahun: "penyusutanFilterTahun",
    filterAwal: "penyusutanFilterAwal",
    filterAkhir: "penyusutanFilterAkhir",
    toggleFormBtn: "penyusutanToggleFormBtn",
    toggleFormLabel: "penyusutanToggleFormLabel",
    formWrapper: "penyusutanFormWrapper",
    keterangan: "penyusutanKeterangan",
    jumlah: "penyusutanJumlah",
    tarif: "penyusutanTarif",
    masaManfaat: "penyusutanMasaManfaat",
    tanggalPerolehan: "penyusutanTanggalPerolehan",
    hargaPerolehan: "penyusutanHargaPerolehan",
    resetBtn: "penyusutanResetBtn",
    submitBtn: "penyusutanSubmitBtn",
    tableWrapper: "penyusutanTableWrapper"
  }
})